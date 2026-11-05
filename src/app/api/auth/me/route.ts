import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getServerStatusOverride, findUserByEmail } from '@/lib/auth/user-registry';
import type { Company, UserRole, MembershipTier, ApprovalStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    let user: any = null;

    // 1. Attempt primary session retrieval via Supabase Auth
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          user = authData.user;
        }
      } catch (authErr) {
        console.warn('[AUTH ME SUPABASE USER WARNING]', authErr);
      }
    }

    // 2. Cookie fallback for cross-lambda / mobile sessions
    if (!user) {
      const sessionCookie = request.cookies.get('b2b_auth_session')?.value;
      if (sessionCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sessionCookie));
          if (parsed && (parsed.email || parsed.id)) {
            user = {
              id: parsed.id,
              email: parsed.email,
              user_metadata: {
                username: parsed.username,
                company_name: parsed.companyName || parsed.company_name,
                contact_name: parsed.contactName || parsed.contact_name,
                role: parsed.role || 'seller',
                membership_tier: parsed.tier || parsed.membership_tier || 'bronze',
                approval_status: parsed.approval_status || 'pending',
              },
            };
          }
        } catch {}
      }
    }

    if (!user) {
      return NextResponse.json({ authenticated: false, company: null });
    }

    const rawEmail = (user.email || '').toLowerCase().trim();
    let companyRow: any = null;

    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        // Query by user_id first
        const { data: byUserId } = await admin
          .from('companies')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (byUserId) {
          companyRow = byUserId;
        } else if (rawEmail) {
          const { data: byEmail } = await admin
            .from('companies')
            .select('*')
            .ilike('contact_email', rawEmail)
            .maybeSingle();
          companyRow = byEmail;

          if (companyRow && !companyRow.user_id && user.id) {
            await admin.from('companies').update({ user_id: user.id }).eq('id', companyRow.id);
          }
        }
      } catch (dbErr) {
        console.warn('[AUTH ME DB QUERY WARNING]', dbErr);
      }
    }

    const metadata = user.user_metadata || {};
    const role: UserRole = (rawEmail === 'admin@b2blink.eu' ? 'admin' : (companyRow?.role || metadata.role || 'seller')) as UserRole;

    // Check status overrides (e.g. approved by admin)
    const serverOverride = (rawEmail ? getServerStatusOverride(rawEmail) : null) ||
                           getServerStatusOverride(user.id) ||
                           (companyRow?.id ? getServerStatusOverride(companyRow.id) : null);

    const overrideStatus = serverOverride?.approval_status;
    const dbStatus = companyRow?.approval_status;
    const metaStatus = metadata.approval_status;

    let effectiveApprovalStatus: ApprovalStatus = 'pending';
    if (role === 'admin' || rawEmail === 'admin@b2blink.eu') {
      effectiveApprovalStatus = 'approved';
    } else if (overrideStatus) {
      effectiveApprovalStatus = overrideStatus as ApprovalStatus;
    } else if (dbStatus) {
      effectiveApprovalStatus = dbStatus as ApprovalStatus;
    } else if (metaStatus) {
      effectiveApprovalStatus = metaStatus as ApprovalStatus;
    }

    // Auto-sync status to database if approved by admin
    if (effectiveApprovalStatus === 'approved' && isSupabaseConfigured()) {
      if (companyRow && companyRow.approval_status !== 'approved') {
        createAdminClient()
          .from('companies')
          .update({ approval_status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', companyRow.id)
          .then(() => {});
      }
      if (user.id && metadata.approval_status !== 'approved') {
        createAdminClient()
          .auth.admin.updateUserById(user.id, {
            user_metadata: { ...metadata, approval_status: 'approved' },
          })
          .then(() => {});
      }
    }

    const rawTiers = [serverOverride?.tier, companyRow?.tier, companyRow?.membership_tier, metadata.membership_tier, metadata.tier].filter(Boolean);
    const effectiveTier = (role === 'admin' ? 'gold' : rawTiers.includes('gold') ? 'gold' : rawTiers.includes('silver') ? 'silver' : 'bronze') as MembershipTier;

    const nowIso = new Date().toISOString();
    const effectiveCompanyName = companyRow?.company_name || companyRow?.name || metadata.company_name || rawEmail.split('@')[0] || 'Wholesale Member';
    const effectiveContactName = companyRow?.contact_name || metadata.contact_name || `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() || 'Valued Member';

    // Track user active timestamp (throttled to at most once per hour)
    const nowIso = new Date().toISOString();
    if (companyRow?.id) {
      const lastActive = companyRow.last_active_at;
      const hoursSince = lastActive ? (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60) : 999;
      if (hoursSince >= 1) {
        admin
          .from('companies')
          .update({
            last_active_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', companyRow.id)
          .then(() => {});
      }
    }

    const normalizedCompany: Company = {
      id: companyRow?.id || user.id,
      user_id: user.id,
      name: effectiveCompanyName,
      company_name: effectiveCompanyName,
      company_number: companyRow?.company_number || metadata.regNumber || null,
      vat_number: companyRow?.vat_number || metadata.vatNumber || null,
      address: companyRow?.address || metadata.address || null,
      website: companyRow?.website || null,
      contact_name: effectiveContactName,
      email: companyRow?.contact_email || rawEmail || '',
      phone: companyRow?.phone || metadata.phone || null,
      role,
      tier: effectiveTier,
      membership_tier: effectiveTier,
      approval_status: effectiveApprovalStatus,
      categories: companyRow?.niches || companyRow?.categories || metadata.selectedNiches || [],
      created_at: companyRow?.created_at || user.created_at || nowIso,
      last_active_at: companyRow?.last_active_at || nowIso,
      last_inactivity_reminder_at: companyRow?.last_inactivity_reminder_at || null,
    };

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: rawEmail,
        metadata: {
          ...metadata,
          approval_status: effectiveApprovalStatus,
          membership_tier: effectiveTier,
        },
      },
      company: normalizedCompany,
      role: normalizedCompany.role,
    });
  } catch (err: any) {
    if (err?.digest === 'HANGING_PROMISE_REJECTION' || err?.digest?.includes('DYNAMIC')) {
      throw err;
    }
    console.error('[/api/auth/me EXCEPTION]', err);
    return NextResponse.json({ authenticated: false, error: 'Internal error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/auth/guards';
import type { Company, UserRole, MembershipTier, ApprovalStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ authenticated: false, isAdmin: false, company: null });
    }

    const admin = createAdminClient();
    const isAdmin = await isUserAdmin(user);

    // Query companies table strictly by user_id
    let companyRow: any = null;
    const { data: byUserId } = await admin
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (byUserId) {
      companyRow = byUserId;
    }

    const metadata = user.user_metadata || {};
    // SECURITY: Admin role is strictly derived from isUserAdmin(user). Never trust user_metadata.
    const role: UserRole = isAdmin
      ? 'admin'
      : (companyRow?.role && companyRow.role !== 'admin' ? companyRow.role : 'seller') as UserRole;
    const approvalStatus: ApprovalStatus = (companyRow?.approval_status || (role === 'admin' ? 'approved' : 'pending')) as ApprovalStatus;

    if (!companyRow) {
      // Auto-create company row if missing. Non-admins MUST always start with 'pending' approval and 'bronze' tier.
      const companyName = metadata.company_name || metadata.contact_name || user.email?.split('@')[0] || 'Member Account';
      const contactName = metadata.contact_name || `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() || 'Member';
      
      const { data: newComp } = await admin.from('companies').insert({
        user_id: user.id,
        company_name: companyName,
        contact_name: contactName,
        contact_email: user.email,
        phone: metadata.phone || null,
        role: isAdmin ? 'admin' : 'seller',
        approval_status: isAdmin ? 'approved' : 'pending',
        tier: 'bronze',
      }).select('*').maybeSingle();

      companyRow = newComp;
    }

    const rawTiers = [companyRow?.tier, companyRow?.membership_tier, metadata.membership_tier, metadata.tier].filter(Boolean);
    const effectiveTier = (rawTiers.includes('gold') ? 'gold' : rawTiers.includes('silver') ? 'silver' : 'bronze') as MembershipTier;

    // SECURITY MANDATE: Approval status is determined strictly from companies.approval_status in the database.
    // NEVER trust user_metadata or client-provided flags.
    const dbStatus = companyRow?.approval_status;
    const effectiveApprovalStatus: ApprovalStatus = (
      role === 'admin'
        ? 'approved'
        : dbStatus === 'approved'
        ? 'approved'
        : dbStatus === 'suspended'
        ? 'suspended'
        : dbStatus === 'rejected'
        ? 'rejected'
        : 'pending'
    );

    // Keep user_metadata synchronized with the authoritative database status (one-way DB -> metadata)
    if (metadata.approval_status !== effectiveApprovalStatus) {
      admin.auth.admin
        .updateUserById(user.id, {
          user_metadata: { ...metadata, approval_status: effectiveApprovalStatus },
        })
        .then(() => {});
    }

    const normalizedCompany: Company = {
      id: companyRow?.id || user.id,
      user_id: user.id,
      name: companyRow?.company_name || companyRow?.name || metadata.company_name || 'Member Account',
      company_name: companyRow?.company_name || companyRow?.name || metadata.company_name || 'Member Account',
      company_number: companyRow?.company_number || metadata.regNumber || null,
      vat_number: companyRow?.vat_number || metadata.vatNumber || null,
      address: companyRow?.address || metadata.address || null,
      website: companyRow?.website || null,
      contact_name: companyRow?.contact_name || metadata.contact_name || `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() || '',
      email: companyRow?.contact_email || user.email || '',
      phone: companyRow?.phone || metadata.phone || null,
      role,
      tier: effectiveTier,
      membership_tier: effectiveTier,
      approval_status: effectiveApprovalStatus,
      rejection_reason: companyRow?.rejection_reason || null,
      categories: companyRow?.niches || companyRow?.categories || metadata.selectedNiches || [],
      created_at: companyRow?.created_at || user.created_at || new Date().toISOString(),
    };

    return NextResponse.json({
      authenticated: true,
      isAdmin,
      user: {
        id: user.id,
        email: user.email,
        app_metadata: user.app_metadata,
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

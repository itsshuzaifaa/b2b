import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { Company, UserRole, MembershipTier, ApprovalStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ authenticated: false, company: null });
    }

    const admin = createAdminClient();

    // Query companies table with admin client to bypass RLS limitations
    let companyRow: any = null;
    const { data: byUserId } = await admin
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (byUserId) {
      companyRow = byUserId;
    } else if (user.email) {
      const { data: byEmail } = await admin
        .from('companies')
        .select('*')
        .eq('contact_email', user.email)
        .maybeSingle();
      companyRow = byEmail;

      // Link user_id if missing
      if (companyRow && !companyRow.user_id) {
        await admin.from('companies').update({ user_id: user.id }).eq('id', companyRow.id);
      }
    }

    const metadata = user.user_metadata || {};
    const role: UserRole = (companyRow?.role || metadata.role || 'buyer') as UserRole;
    const approvalStatus: ApprovalStatus = 'approved';

    if (!companyRow) {
      // Auto-create company row if missing
      const companyName = metadata.company_name || metadata.contact_name || user.email?.split('@')[0] || 'Member Account';
      const contactName = metadata.contact_name || `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() || 'Member';
      
      const { data: newComp } = await admin.from('companies').insert({
        user_id: user.id,
        company_name: companyName,
        contact_name: contactName,
        contact_email: user.email,
        phone: metadata.phone || null,
        role,
        approval_status: 'approved',
        tier: role === 'seller' ? (metadata.membership_tier || 'silver') : 'bronze',
      }).select('*').maybeSingle();

      companyRow = newComp;
    }

    const effectiveTier = (companyRow?.tier || companyRow?.membership_tier || metadata.membership_tier || (role === 'seller' ? 'silver' : 'bronze')) as MembershipTier;

    const normalizedCompany: Company = {
      id: companyRow?.id || user.id,
      user_id: user.id,
      name: companyRow?.company_name || companyRow?.name || metadata.company_name || 'Member Account',
      company_name: companyRow?.company_name || companyRow?.name || metadata.company_name || 'Member Account',
      company_number: companyRow?.company_number || null,
      vat_number: companyRow?.vat_number || null,
      address: companyRow?.address || null,
      website: companyRow?.website || null,
      contact_name: companyRow?.contact_name || metadata.contact_name || `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() || '',
      email: companyRow?.contact_email || user.email || '',
      phone: companyRow?.phone || metadata.phone || null,
      role,
      tier: effectiveTier,
      membership_tier: effectiveTier,
      approval_status: 'approved',
      categories: companyRow?.niches || companyRow?.categories || [],
      created_at: companyRow?.created_at || user.created_at || new Date().toISOString(),
    };

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
      },
      company: normalizedCompany,
      role: normalizedCompany.role,
    });
  } catch (err) {
    console.error('[/api/auth/me EXCEPTION]', err);
    return NextResponse.json({ authenticated: false, error: 'Internal error' }, { status: 500 });
  }
}

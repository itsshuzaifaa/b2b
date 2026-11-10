import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/guards';
import { sendKycVerificationRequestEmail } from '@/lib/email/dispatcher';

export async function POST(request: NextRequest) {
  // SECURITY MANDATE: Require authenticated user session.
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    // Non-admins can ONLY dispatch KYC for their own session email and company.
    // Untrusted body.email is ignored for non-admins to prevent touching another company.
    const effectiveEmail = auth.isAdmin && body.email
      ? String(body.email).trim().toLowerCase()
      : (auth.user.email || '').trim().toLowerCase();

    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid corporate email required.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch company record for this user strictly
    let companyQuery = admin.from('companies').select('*');
    if (auth.isAdmin && body.email) {
      companyQuery = companyQuery.eq('contact_email', effectiveEmail);
    } else {
      companyQuery = companyQuery.or(`user_id.eq.${auth.user.id},contact_email.eq.${effectiveEmail}`);
    }

    const { data: company } = await companyQuery.maybeSingle();

    // 2. Fetch auth user
    let user: any = auth.user;
    if (auth.isAdmin && body.email && company?.user_id && company.user_id !== auth.user.id) {
      try {
        const { data: uData } = await admin.auth.admin.getUserById(company.user_id);
        user = uData?.user || user;
      } catch {}
    }

    const meta = user?.user_metadata || {};

    // Check if KYC email was already dispatched to prevent duplicate spamming
    if (meta.kyc_dispatched) {
      return NextResponse.json({
        success: true,
        alreadyDispatched: true,
        message: 'KYC documents email already dispatched.',
      });
    }

    const effectiveCompanyName =
      company?.company_name ||
      company?.name ||
      meta.company_name ||
      meta.contact_name ||
      'Wholesale Trading Partner';

    const effectiveContactName =
      company?.contact_name ||
      meta.contact_name ||
      `${meta.first_name || ''} ${meta.last_name || ''}`.trim() ||
      'Valued Partner';

    const effectivePhone = company?.phone || meta.phone || null;
    const effectiveAddress = company?.address || meta.address || null;

    // 3. Dispatch Business Verification Request email
    const emailResult = await sendKycVerificationRequestEmail(effectiveEmail, {
      companyName: effectiveCompanyName,
      contactName: effectiveContactName,
      email: effectiveEmail,
      phone: effectivePhone,
      address: effectiveAddress,
    });

    // 4. Preserve existing approval_status - NEVER reset an approved account!
    const currentApprovalStatus = company?.approval_status || 'pending';

    if (user?.id) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...meta,
          kyc_dispatched: true,
          email_verified_at: new Date().toISOString(),
          approval_status: currentApprovalStatus,
        },
      });
    }

    // 5. If company row status is not set, set to pending; if already approved/suspended/rejected, NEVER overwrite it!
    if (company?.id && !company.approval_status) {
      await admin
        .from('companies')
        .update({
          approval_status: 'pending',
        })
        .eq('id', company.id);
    }

    return NextResponse.json({
      success: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error,
    });
  } catch (err) {
    console.error('[/api/auth/dispatch-kyc EXCEPTION]', err);
    return NextResponse.json(
      { error: 'Failed to dispatch KYC verification email.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendKycVerificationRequestEmail } from '@/lib/email/dispatcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = (body.email || '').trim().toLowerCase();

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch company record for this email
    const { data: company } = await admin
      .from('companies')
      .select('*')
      .eq('contact_email', rawEmail)
      .maybeSingle();

    // 2. Fetch auth user to get metadata
    const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = usersList?.users?.find(
      (u) => u.email?.toLowerCase().trim() === rawEmail
    );

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

    // 3. Dispatch KYC checklist email to customer and alert newcustomers@brandnova.info
    const emailResult = await sendKycVerificationRequestEmail(rawEmail, {
      companyName: effectiveCompanyName,
      contactName: effectiveContactName,
      email: rawEmail,
      phone: effectivePhone,
      address: effectiveAddress,
    });

    // 4. Mark kyc_dispatched in user metadata
    if (user?.id) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...meta,
          kyc_dispatched: true,
          email_verified_at: new Date().toISOString(),
          approval_status: 'pending',
        },
      });
    }

    // 5. Ensure company approval_status is strictly pending
    if (company?.id) {
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

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendVerificationEmail } from '@/lib/email/dispatcher';
import { getDynamicAppUrl, sanitizeActionUrl } from '@/lib/utils/app-url';
import { saveVerificationCode } from '@/lib/auth/verification-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = (body.email || '').trim().toLowerCase();
    const contactName = (body.contactName || '').trim();

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid corporate email address.' },
        { status: 400 }
      );
    }

    const appUrl = await getDynamicAppUrl(request);
    const redirectUrl = `${appUrl}/auth/callback`;

    const admin = createAdminClient();

    // 1. Generate verification link and OTP
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: rawEmail,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError || !linkData?.properties) {
      console.error('[SEND VERIFICATION GENERATE ERROR]', linkError);
      return NextResponse.json(
        { error: linkError?.message || 'Unable to generate verification link.' },
        { status: 400 }
      );
    }

    const rawActionLink = linkData.properties.action_link;
    const actionLink = rawActionLink
      ? sanitizeActionUrl(rawActionLink, appUrl)
      : `${appUrl}/verify-email?email=${encodeURIComponent(rawEmail)}`;
    const otpCode = linkData.properties.email_otp || 'VERIFY';

    // Register active OTP: valid for 15 minutes, immediately invalidating any prior code
    if (otpCode) {
      saveVerificationCode(rawEmail, otpCode);
    }

    // 2. Dispatch branded email via Resend
    const emailResult = await sendVerificationEmail(rawEmail, {
      recipientEmail: rawEmail,
      contactName: contactName || undefined,
      otpCode,
      actionUrl: actionLink,
    });

    if (!emailResult.success) {
      console.warn('[SEND VERIFICATION EMAIL NOTICE]', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${rawEmail}.`,
      expiresIn: 900, // 15 minutes
      resendCooldown: 60, // 1 minute
      // For seamless local testing only: return otp in non-production
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otpCode } : {}),
    });
  } catch (err) {
    console.error('[SEND VERIFICATION EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while sending verification email.' },
      { status: 500 }
    );
  }
}

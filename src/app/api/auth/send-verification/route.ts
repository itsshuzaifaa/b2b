import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendVerificationEmail } from '@/lib/email/dispatcher';

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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

    const actionLink = linkData.properties.action_link;
    const otpCode = linkData.properties.email_otp || 'VERIFY';

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

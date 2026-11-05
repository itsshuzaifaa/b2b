import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
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
    let actionLink = `${appUrl}/verify-email?email=${encodeURIComponent(rawEmail)}`;
    let otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Try to generate verification link and OTP via Supabase Admin
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: rawEmail,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (!linkError && linkData?.properties) {
        if (linkData.properties.email_otp) {
          otpCode = linkData.properties.email_otp;
        }
        if (linkData.properties.action_link) {
          actionLink = sanitizeActionUrl(linkData.properties.action_link, appUrl);
        }
      }
    } catch (adminErr) {
      console.warn('[SEND VERIFICATION SUPABASE NOTICE]', adminErr);
    }
  }

    // 2. Register active OTP: valid for 15 minutes, immediately invalidating any prior code
    saveVerificationCode(rawEmail, otpCode);

    // 3. Dispatch branded email via Resend
    try {
      const emailResult = await sendVerificationEmail(rawEmail, {
        recipientEmail: rawEmail,
        contactName: contactName || undefined,
        otpCode,
        actionUrl: actionLink,
      });

      if (!emailResult.success) {
        console.warn('[SEND VERIFICATION EMAIL NOTICE]', emailResult.error);
      }
    } catch (emailErr) {
      console.warn('[SEND VERIFICATION EMAIL EXCEPTION NOTICE]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${rawEmail}.`,
      expiresIn: 900, // 15 minutes
      resendCooldown: 60, // 1 minute
      // For seamless local testing: return otp
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otpCode } : {}),
    });
  } catch (err: any) {
    console.error('[SEND VERIFICATION EXCEPTION]', err);
    return NextResponse.json(
      { error: err?.message || 'An unexpected error occurred while sending verification email.' },
      { status: 500 }
    );
  }
}

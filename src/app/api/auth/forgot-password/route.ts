import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { sendPasswordResetEmail } from '@/lib/email/dispatcher';
import { getDynamicAppUrl, sanitizeActionUrl } from '@/lib/utils/app-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = (body.email || '').trim().toLowerCase();

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const appUrl = await getDynamicAppUrl(request);
    const redirectUrl = `${appUrl}/reset-password`;
    let actionLink = `${appUrl}/reset-password?email=${encodeURIComponent(rawEmail)}`;

    // 1. Try to generate password recovery link via Supabase Admin
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: rawEmail,
          options: {
            redirectTo: redirectUrl,
          },
        });

        if (!error && data?.properties?.action_link) {
          actionLink = sanitizeActionUrl(data.properties.action_link, appUrl);
        }
      } catch (adminErr) {
        console.warn('[FORGOT PASSWORD SUPABASE NOTICE]', adminErr);
      }
    }

    // 2. Dispatch branded email via Resend
    try {
      const emailResult = await sendPasswordResetEmail(rawEmail, {
        recipientEmail: rawEmail,
        actionUrl: actionLink,
      });

      if (!emailResult.success) {
        console.warn('[FORGOT PASSWORD EMAIL NOTICE]', emailResult.error);
      }
    } catch (emailErr) {
      console.warn('[FORGOT PASSWORD EMAIL EXCEPTION]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: `We've sent a verification link to ${rawEmail}. Please check your inbox to reset your password.`,
    });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD EXCEPTION]', err);
    return NextResponse.json(
      { error: err?.message || 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

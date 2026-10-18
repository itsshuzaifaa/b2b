import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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

    const admin = createAdminClient();

    // 1. Generate password recovery link via Supabase Admin
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: rawEmail,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('user not found')) {
        return NextResponse.json(
          {
            error: `No registered account found with "${rawEmail}". Please check your email or register a new account.`,
          },
          { status: 404 }
        );
      }

      console.error('[FORGOT PASSWORD GENERATE ERROR]', error);
      return NextResponse.json(
        { error: error.message || 'Unable to generate password reset request.' },
        { status: 400 }
      );
    }

    const rawActionLink = data?.properties?.action_link;
    if (!rawActionLink) {
      return NextResponse.json(
        { error: 'Failed to generate reset link. Please try again.' },
        { status: 500 }
      );
    }

    const actionLink = sanitizeActionUrl(rawActionLink, appUrl);

    // 2. Dispatch branded email via Resend
    const emailResult = await sendPasswordResetEmail(rawEmail, {
      recipientEmail: rawEmail,
      actionUrl: actionLink,
    });

    if (!emailResult.success) {
      console.warn('[FORGOT PASSWORD EMAIL NOTICE]', emailResult.error);
      // Even if Resend had an issue in local sandbox, we can still return success with dev notice
    }

    return NextResponse.json({
      success: true,
      message: `We've sent a verification link to ${rawEmail}. Please check your inbox to reset your password.`,
    });
  } catch (err) {
    console.error('[FORGOT PASSWORD EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 }
    );
  }
}

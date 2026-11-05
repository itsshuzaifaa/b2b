import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendVerificationEmail } from '@/lib/email/dispatcher';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetEmail = (searchParams.get('email') || 'huzaifaf558@gmail.com').trim().toLowerCase();

  return handleTestSend(targetEmail);
}

export async function POST(request: NextRequest) {
  let targetEmail = 'huzaifaf558@gmail.com';
  try {
    const body = await request.json();
    if (body.email) targetEmail = body.email.trim().toLowerCase();
  } catch {}

  return handleTestSend(targetEmail);
}

async function handleTestSend(email: string) {
  const rawKey = (process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_RESEND_API_KEY)?.trim() || '';
  const configuredFromEmail = (process.env.RESEND_FROM_EMAIL || 'B2B LINK <notifications@brandnova.info>').trim();

  // Mask key for safe inspection: e.g. re_abc...1234
  const maskedKey = rawKey
    ? `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}`
    : 'NOT SET';

  if (!rawKey || rawKey.includes('placeholder') || rawKey.includes('your_resend') || rawKey === 're_123456789_abcdefg') {
    return NextResponse.json({
      success: false,
      diagnostic: 'RESEND_API_KEY is not configured with a real key.',
      apiKeyStatus: {
        configured: false,
        maskedKey,
        hint: 'Please add a real RESEND_API_KEY in Vercel -> Settings -> Environment Variables.',
      },
      configuredFromEmail,
      recipient: email,
    });
  }

  const resend = new Resend(rawKey);
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // 1. Attempt sending via primary configured sender
  let firstAttemptError: any = null;
  let primarySuccess: any = null;

  try {
    const res = await resend.emails.send({
      from: configuredFromEmail,
      to: email,
      subject: `B2B LINK Verification Code [${testOtp}] - Resend Test`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px;">
          <div style="margin-bottom: 24px; text-align: center;">
            <h1 style="color: #0F172A; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0;">B2B <span style="color: #0A6CFF;">LINK</span></h1>
            <p style="color: #64748B; font-size: 13px; margin: 4px 0 0;">Wholesale Trading Network Verification</p>
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="color: #475569; font-size: 14px; margin: 0 0 12px;">Your one-time account verification code is:</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0A6CFF; font-family: monospace;">${testOtp}</div>
            <p style="color: #94A3B8; font-size: 12px; margin: 12px 0 0;">Valid for 15 minutes. Never share this code with anyone.</p>
          </div>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">This is a live connection test between your Resend account and B2B LINK.</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
          <p style="color: #94A3B8; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} B2B LINK. Verified Wholesale Trading.</p>
        </div>
      `,
      replyTo: 'support@b2blink.eu',
    });

    if (res.error) {
      firstAttemptError = res.error;
    } else {
      primarySuccess = res.data;
    }
  } catch (err: any) {
    firstAttemptError = { message: err?.message || String(err) };
  }

  if (primarySuccess) {
    return NextResponse.json({
      success: true,
      deliveredBy: configuredFromEmail,
      messageId: primarySuccess.id,
      recipient: email,
      otpSent: testOtp,
      note: `Email successfully dispatched to ${email} using ${configuredFromEmail}.`,
    });
  }

  // 2. If primary failed, check if it's due to unverified custom domain and retry with onboarding@resend.dev
  let fallbackSuccess: any = null;
  let fallbackError: any = null;

  try {
    const res = await resend.emails.send({
      from: 'B2B LINK <onboarding@resend.dev>',
      to: email,
      subject: `B2B LINK Verification Code [${testOtp}] - Resend Test (Fallback)`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px;">
          <h2 style="color: #0F172A; margin: 0 0 16px;">B2B LINK Test Verification Code</h2>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px; text-align: center; margin: 16px 0;">
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0A6CFF; font-family: monospace;">${testOtp}</div>
          </div>
          <p style="color: #475569; font-size: 13px;">Sent via Resend test domain (onboarding@resend.dev).</p>
        </div>
      `,
    });

    if (res.error) {
      fallbackError = res.error;
    } else {
      fallbackSuccess = res.data;
    }
  } catch (err: any) {
    fallbackError = { message: err?.message || String(err) };
  }

  if (fallbackSuccess) {
    return NextResponse.json({
      success: true,
      deliveredBy: 'onboarding@resend.dev (Fallback)',
      messageId: fallbackSuccess.id,
      recipient: email,
      otpSent: testOtp,
      warning: `Your custom sender "${configuredFromEmail}" failed because: ${firstAttemptError?.message}. The email was sent via Resend's default domain (onboarding@resend.dev). To send from your domain, verify it in Resend Dashboard -> Domains.`,
    });
  }

  // Both attempts failed: return full diagnostics
  return NextResponse.json({
    success: false,
    recipient: email,
    primaryAttempt: {
      from: configuredFromEmail,
      error: firstAttemptError?.message || firstAttemptError,
    },
    fallbackAttempt: {
      from: 'onboarding@resend.dev',
      error: fallbackError?.message || fallbackError,
    },
    apiKeyStatus: {
      configured: true,
      maskedKey,
    },
    recommendation: getRecommendation(firstAttemptError?.message || '', fallbackError?.message || ''),
  }, { status: 400 });
}

function getRecommendation(err1: string, err2: string): string {
  const full = `${err1} ${err2}`.toLowerCase();
  if (full.includes('api key') || full.includes('invalid') || full.includes('unauthorized')) {
    return 'Your RESEND_API_KEY appears to be invalid or revoked. Please create a new key at https://resend.com/api-keys and paste it into Vercel Environment Variables.';
  }
  if (full.includes('can only send testing emails to your own email address') || full.includes('testing emails')) {
    return 'Resend free sandbox accounts can only send emails to the email address you registered your Resend account with. To send to any recipient (like customer registrations), go to Resend Dashboard -> Domains -> Add Domain and add your domain DNS records.';
  }
  if (full.includes('domain') || full.includes('verify')) {
    return 'Your sender domain is not verified in Resend. Either verify your domain in Resend -> Domains, or set RESEND_FROM_EMAIL="onboarding@resend.dev" in Vercel for testing.';
  }
  return 'Please check your Resend Dashboard at https://resend.com/overview for specific account or domain restrictions.';
}

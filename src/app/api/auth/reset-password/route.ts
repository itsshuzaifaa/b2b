import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendPasswordResetOtpEmail } from '@/lib/email/dispatcher';

// In-memory OTP storage for password resets (15 minute validity)
interface StoredOtp {
  code: string;
  expiresAt: number;
}

// Global declaration to maintain OTP cache across Next.js API reloads
declare global {
  // eslint-disable-next-line no-var
  var __b2b_password_reset_otps: Map<string, StoredOtp> | undefined;
}

const otpStore: Map<string, StoredOtp> =
  global.__b2b_password_reset_otps || new Map<string, StoredOtp>();
global.__b2b_password_reset_otps = otpStore;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || (body.oldPassword ? 'reset_with_old_password' : 'verify_code_and_reset');
    const rawEmail = (body.email || '').trim().toLowerCase();

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid registered email address.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // ========================================================
    // ACTION 1: SEND VERIFICATION CODE TO EMAIL
    // ========================================================
    if (action === 'send_code') {
      // 1. Generate 6-digit numeric OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      otpStore.set(rawEmail, {
        code: otpCode,
        expiresAt,
      });

      // 2. Fetch contact name if exists
      let contactName: string | undefined;
      try {
        const { data: comp } = await admin
          .from('companies')
          .select('contact_name, name')
          .ilike('contact_email', rawEmail)
          .maybeSingle();

        if (comp) {
          contactName = comp.contact_name || comp.name;
        }
      } catch {
        // ignore
      }

      // 3. Dispatch branded verification code email
      const emailResult = await sendPasswordResetOtpEmail(rawEmail, {
        recipientEmail: rawEmail,
        otpCode,
        contactName,
      });

      if (!emailResult.success) {
        console.warn('[RESET PASSWORD OTP DISPATCH NOTICE]', emailResult.error);
      }

      return NextResponse.json({
        success: true,
        message: `We've sent a 6-digit verification code to ${rawEmail}. Please check your inbox.`,
        // In local development sandbox return devOtp for seamless testing if needed
        ...(process.env.NODE_ENV !== 'production' ? { devOtp: otpCode } : {}),
      });
    }

    // ========================================================
    // ACTION 2: RESET USING VERIFICATION CODE
    // ========================================================
    if (action === 'verify_code_and_reset') {
      const code = (body.code || '').trim();
      const newPassword = body.newPassword || '';

      if (!code) {
        return NextResponse.json(
          { error: 'Please enter the 6-digit verification code sent to your email.' },
          { status: 400 }
        );
      }

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters long.' },
          { status: 400 }
        );
      }

      // Check stored OTP
      const stored = otpStore.get(rawEmail);
      if (!stored) {
        return NextResponse.json(
          { error: 'No verification code was requested for this email, or it has expired. Please request a new code.' },
          { status: 400 }
        );
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(rawEmail);
        return NextResponse.json(
          { error: 'Verification code has expired. Please click "Send code" again.' },
          { status: 400 }
        );
      }

      if (stored.code !== code) {
        return NextResponse.json(
          { error: 'Invalid verification code. Please check your email and enter the 6 digits carefully.' },
          { status: 400 }
        );
      }

      // Code is valid! Find user in Supabase
      const { data: usersData, error: listError } = await admin.auth.admin.listUsers();
      if (listError) {
        console.error('[RESET PASSWORD LIST USERS ERROR]', listError);
      }

      const targetUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === rawEmail
      );

      if (!targetUser) {
        return NextResponse.json(
          { error: `No registered account found with ${rawEmail}. Please check your email or register.` },
          { status: 404 }
        );
      }

      // Update password via Supabase Admin
      const { error: updateError } = await admin.auth.admin.updateUserById(targetUser.id, {
        password: newPassword,
      });

      if (updateError) {
        console.error('[RESET PASSWORD UPDATE ERROR]', updateError);
        return NextResponse.json(
          { error: updateError.message || 'Failed to update password.' },
          { status: 400 }
        );
      }

      // Invalidate OTP after successful reset
      otpStore.delete(rawEmail);

      return NextResponse.json({
        success: true,
        message: 'Your password has been reset successfully. You can now sign in with your new password.',
      });
    }

    // ========================================================
    // ACTION 3: RESET USING CURRENT / OLD PASSWORD
    // ========================================================
    if (action === 'reset_with_old_password') {
      const oldPassword = body.oldPassword || '';
      const newPassword = body.newPassword || '';

      if (!oldPassword) {
        return NextResponse.json(
          { error: 'Please enter your current/old password.' },
          { status: 400 }
        );
      }

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters long.' },
          { status: 400 }
        );
      }

      if (oldPassword === newPassword) {
        return NextResponse.json(
          { error: 'New password must be different from your current password.' },
          { status: 400 }
        );
      }

      // Verify old password against Supabase Auth
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email: rawEmail,
        password: oldPassword,
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: 'The current password you entered is incorrect. Please verify your credentials.' },
          { status: 400 }
        );
      }

      // Old password verified! Update to new password via Admin client
      const { error: updateError } = await admin.auth.admin.updateUserById(authData.user.id, {
        password: newPassword,
      });

      if (updateError) {
        console.error('[RESET PASSWORD UPDATE BY ID ERROR]', updateError);
        return NextResponse.json(
          { error: updateError.message || 'Failed to update password.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Your password has been changed successfully.',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action requested.' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[RESET PASSWORD EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your password reset.' },
      { status: 500 }
    );
  }
}

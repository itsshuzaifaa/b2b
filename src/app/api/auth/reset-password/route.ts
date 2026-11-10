import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendPasswordResetOtpEmail } from '@/lib/email/dispatcher';
import { saveHashedOtp, verifyHashedOtp, consumeHashedOtp } from '@/lib/auth/otp-store';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = await enforceRateLimit(request, 'reset-password');
  if (rateLimitRes) return rateLimitRes;
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
      
      // Store hashed OTP in Redis/database with 15-min expiry and max 5 attempts
      await saveHashedOtp('recovery', rawEmail, otpCode);

      // 2. Fetch contact name if exists
      let contactName: string | undefined;
      try {
        const { data: comp } = await admin
          .from('companies')
          .select('contact_name, company_name')
          .ilike('contact_email', rawEmail)
          .maybeSingle();

        if (comp) {
          contactName = comp.contact_name || comp.company_name;
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

      // CRITICAL SECURITY MANDATE: Password reset response is identical whether or not email exists
      return NextResponse.json({
        success: true,
        message: `If an account exists with this email, a 6-digit verification code has been dispatched to your inbox.`,
        ...(process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true' ? { devOtp: otpCode } : {}),
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

      // Validate hashed OTP (enforces 15-min expiry, single-use, max 5 attempts, missing code check)
      const otpValidation = await verifyHashedOtp('recovery', rawEmail, code);
      if (!otpValidation.valid) {
        return NextResponse.json(
          { error: otpValidation.error || 'Verification code has expired or is invalid.' },
          { status: 400 }
        );
      }

      // Code is valid! Find user: check companies first (takes ~15ms)
      let targetUserId: string | null = null;
      const { data: comp } = await admin
        .from('companies')
        .select('user_id')
        .eq('contact_email', rawEmail)
        .maybeSingle();

      if (comp?.user_id) {
        targetUserId = comp.user_id;
      } else {
        const timeoutPromise = new Promise<{ data: { users: any[] } | null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 2000)
        );
        const listPromise = admin.auth.admin.listUsers({ page: 1, perPage: 100 });
        const raceResult = await Promise.race([listPromise, timeoutPromise]);
        const usersData = (raceResult as any)?.data?.users || [];
        const found = usersData.find(
          (u: any) => u.email?.toLowerCase() === rawEmail
        );
        if (found) {
          targetUserId = found.id;
        }
      }

      if (!targetUserId) {
        return NextResponse.json(
          { error: `No registered account found with ${rawEmail}. Please check your email or register.` },
          { status: 404 }
        );
      }

      // Update password via Supabase Admin
      const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
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
      await consumeHashedOtp('recovery', rawEmail);

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

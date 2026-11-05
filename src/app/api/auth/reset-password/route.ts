import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendPasswordResetOtpEmail } from '@/lib/email/dispatcher';
import {
  findUserByIdentifier,
  findUserByEmail,
  updateUserPassword,
  registerUserAccount,
} from '@/lib/auth/user-registry';

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
    const rawInput = (body.email || body.username || body.identifier || '').trim().toLowerCase();

    if (!rawInput) {
      return NextResponse.json(
        { error: 'Please enter a valid registered corporate email address or username.' },
        { status: 400 }
      );
    }

    // Resolve identifier to email and user record if in user-registry
    const regUser = findUserByIdentifier(rawInput) || findUserByEmail(rawInput);
    let rawEmail = regUser?.email ? regUser.email.toLowerCase().trim() : rawInput;

    // ========================================================
    // ACTION 1: SEND VERIFICATION CODE TO EMAIL
    // ========================================================
    if (action === 'send_code') {
      let contactName: string | undefined = regUser?.contactName || regUser?.firstName;

      // If not yet an email address, try looking up in Supabase companies
      if (!rawEmail.includes('@') && isSupabaseConfigured()) {
        try {
          const admin = createAdminClient();
          const { data: comp } = await admin
            .from('companies')
            .select('contact_name, company_name, contact_email')
            .or(`contact_email.ilike.${rawInput},name.ilike.${rawInput}`)
            .maybeSingle();

          if (comp?.contact_email) {
            rawEmail = comp.contact_email.toLowerCase().trim();
            contactName = contactName || comp.contact_name || comp.company_name;
          }
        } catch {}
      }

      if (!rawEmail || !rawEmail.includes('@')) {
        return NextResponse.json(
          { error: `No registered account found with "${rawInput}". Please check your email or username.` },
          { status: 404 }
        );
      }

      // Check contact name from Supabase companies if not found in registry
      if (!contactName && isSupabaseConfigured()) {
        try {
          const admin = createAdminClient();
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
      }

      // 1. Generate 6-digit numeric OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      otpStore.set(rawEmail, {
        code: otpCode,
        expiresAt,
      });
      // Also map rawInput (e.g. username) if different
      if (rawInput !== rawEmail) {
        otpStore.set(rawInput, {
          code: otpCode,
          expiresAt,
        });
      }

      // 2. Dispatch branded verification code email
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
        ...(process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true' ? { devOtp: otpCode } : {}),
      });
    }

    // ========================================================
    // ACTION 2: RESET USING VERIFICATION CODE
    // ========================================================
    if (action === 'verify_code_and_reset') {
      const code = (body.code || '').trim().replace(/\s+/g, '');
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

      // Check stored OTP by rawEmail or rawInput
      let stored = otpStore.get(rawEmail) || otpStore.get(rawInput);
      if (!stored && regUser?.email) {
        stored = otpStore.get(regUser.email.toLowerCase().trim());
      }

      if (!stored) {
        return NextResponse.json(
          { error: 'No verification code was requested for this email, or it has expired. Please request a new code.' },
          { status: 400 }
        );
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(rawEmail);
        otpStore.delete(rawInput);
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

      // 1. Update password in user-registry
      const targetEmail = rawEmail.includes('@') ? rawEmail : (regUser?.email || rawEmail);
      let registryUpdated = updateUserPassword(targetEmail, newPassword);
      if (rawInput !== targetEmail) {
        registryUpdated = updateUserPassword(rawInput, newPassword) || registryUpdated;
      }

      // If user was not yet in user-registry, register them now so login works immediately!
      if (!registryUpdated) {
        registerUserAccount({
          id: `usr_${Date.now().toString(36)}`,
          email: targetEmail,
          username: regUser?.username || rawInput.replace(/@.*$/, ''),
          plainPassword: newPassword,
          contactName: regUser?.contactName || 'Wholesale Member',
          companyName: regUser?.companyName || 'Wholesale Member',
          companyId: regUser?.companyId || `comp_${Date.now().toString(36)}`,
          role: 'seller',
          tier: 'bronze',
          approval_status: 'pending',
          emailConfirmed: true,
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Also update password in Supabase Auth if configured
      if (isSupabaseConfigured()) {
        try {
          const admin = createAdminClient();
          const { data: usersData } = await admin.auth.admin.listUsers();
          const targetUser = usersData?.users?.find(
            (u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()
          );

          if (targetUser) {
            await admin.auth.admin.updateUserById(targetUser.id, {
              password: newPassword,
            });
          }
        } catch (updateErr) {
          console.warn('[RESET PASSWORD SUPABASE UPDATE NOTICE]', updateErr);
        }
      }

      // Invalidate OTP after successful reset
      otpStore.delete(rawEmail);
      otpStore.delete(rawInput);
      if (targetEmail) otpStore.delete(targetEmail);

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

      const targetEmail = rawEmail.includes('@') ? rawEmail : (regUser?.email || rawEmail);
      let verified = false;

      // 1. Verify against user registry
      if (regUser?.plainPassword) {
        if (regUser.plainPassword === oldPassword) {
          verified = true;
        } else {
          return NextResponse.json(
            { error: 'The current password you entered is incorrect. Please verify your credentials.' },
            { status: 400 }
          );
        }
      }

      // 2. If not verified via registry, try Supabase Auth
      if (!verified && isSupabaseConfigured()) {
        try {
          const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

          const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
          });

          const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
            email: targetEmail,
            password: oldPassword,
          });

          if (!authError && authData?.user) {
            verified = true;
          }
        } catch (sbAuthErr) {
          console.warn('[RESET PASSWORD SUPABASE AUTH VERIFY NOTICE]', sbAuthErr);
        }
      }

      if (!verified) {
        return NextResponse.json(
          { error: 'The current password you entered is incorrect. Please verify your credentials.' },
          { status: 400 }
        );
      }

      // Update in user-registry
      updateUserPassword(targetEmail, newPassword);
      if (rawInput !== targetEmail) {
        updateUserPassword(rawInput, newPassword);
      }

      // Update in Supabase Auth if configured
      if (isSupabaseConfigured()) {
        try {
          const admin = createAdminClient();
          const { data: usersData } = await admin.auth.admin.listUsers();
          const targetUser = usersData?.users?.find(
            (u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()
          );

          if (targetUser) {
            await admin.auth.admin.updateUserById(targetUser.id, {
              password: newPassword,
            });
          }
        } catch (updateErr) {
          console.warn('[RESET PASSWORD SUPABASE UPDATE ERROR]', updateErr);
        }
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

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  validateVerificationCode,
  consumeVerificationCode,
} from '@/lib/auth/verification-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = (body.email || '').trim().toLowerCase();
    const code = (body.code || '').trim().replace(/\s+/g, '');

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Please enter the verification code.' },
        { status: 400 }
      );
    }

    // 1. Enforce 15-minute timer and latest-code rule
    const validation = validateVerificationCode(rawEmail, code);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Verification code has expired or is invalid.' },
        { status: 400 }
      );
    }

    // 2. Locate user and confirm email in Supabase
    const admin = createAdminClient();
    let confirmedUserId: string | null = null;

    try {
      // Find user: check companies first (takes ~15ms)
      const { data: company } = await admin
        .from('companies')
        .select('user_id')
        .eq('contact_email', rawEmail)
        .maybeSingle();

      if (company?.user_id) {
        confirmedUserId = company.user_id;
      } else {
        const timeoutPromise = new Promise<{ data: { users: any[] } | null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 2000)
        );
        const listPromise = admin.auth.admin.listUsers({ page: 1, perPage: 100 });
        const raceResult = await Promise.race([listPromise, timeoutPromise]);
        const usersData = (raceResult as any)?.data?.users || [];
        const targetUser = usersData.find(
          (u: any) => u.email?.toLowerCase() === rawEmail
        );
        if (targetUser) {
          confirmedUserId = targetUser.id;
        }
      }

      if (confirmedUserId) {
        await admin.auth.admin.updateUserById(confirmedUserId, {
          email_confirm: true,
        });

        // Also update companies record if pending verification
        await admin
          .from('companies')
          .update({
            approval_status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', confirmedUserId)
          .eq('approval_status', 'pending_verification');
      }
    } catch (adminErr) {
      console.warn('[VERIFY CODE ADMIN CONFIRM NOTICE]', adminErr);
    }

    // 3. Consume the code so it cannot be reused
    consumeVerificationCode(rawEmail);

    return NextResponse.json({
      success: true,
      message: 'Verification code validated successfully.',
      userId: confirmedUserId,
    });
  } catch (err) {
    console.error('[VERIFY CODE EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying code.' },
      { status: 500 }
    );
  }
}

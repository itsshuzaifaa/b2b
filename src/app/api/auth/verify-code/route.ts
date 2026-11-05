import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
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
    let confirmedUserId: string | null = null;
    let targetUser: any = null;
    let companyRecord: any = null;

    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        // Find user by email
        const { data: usersData } = await admin.auth.admin.listUsers();
        targetUser = usersData?.users?.find(
          (u: any) => u.email?.toLowerCase() === rawEmail
        );

        if (targetUser) {
          confirmedUserId = targetUser.id;
          const userMeta = targetUser.user_metadata || {};
          const metaTier = userMeta.membership_tier || userMeta.tier || 'bronze';

          // Strictly preserve or enforce pending approval_status unless already vetted by admin
          const effectiveStatus = userMeta.approval_status === 'approved' ? 'approved' : 'pending';

          await admin.auth.admin.updateUserById(targetUser.id, {
            email_confirm: true,
            user_metadata: {
              ...userMeta,
              email_verified: true,
              email_confirmed_at: new Date().toISOString(),
              approval_status: effectiveStatus,
            },
          });

          // Also update companies record
          const { data: comp } = await admin
            .from('companies')
            .update({
              approval_status: effectiveStatus,
              updated_at: new Date().toISOString(),
            })
            .or(`user_id.eq.${targetUser.id},contact_email.ilike.${rawEmail}`)
            .select('*')
            .maybeSingle();

          companyRecord = comp;
        }
      } catch (adminErr) {
        console.warn('[VERIFY CODE ADMIN CONFIRM NOTICE]', adminErr);
      }
    }

    // 3. Consume the code so it cannot be reused
    consumeVerificationCode(rawEmail);

    // Confirm email in user registry
    try {
      const { confirmUserEmail } = await import('@/lib/auth/user-registry');
      confirmUserEmail(rawEmail);
    } catch {}

    // Set persistent session cookie so user is authenticated across lambdas
    try {
      const cookieStore = await cookies();
      const finalRole = companyRecord?.role || targetUser?.user_metadata?.role || 'seller';
      const finalTier = companyRecord?.tier || targetUser?.user_metadata?.membership_tier || 'bronze';
      const finalStatus = companyRecord?.approval_status || targetUser?.user_metadata?.approval_status || 'pending';
      const finalCompName = companyRecord?.company_name || targetUser?.user_metadata?.company_name || rawEmail.split('@')[0];
      const finalContactName = companyRecord?.contact_name || targetUser?.user_metadata?.contact_name || 'Member';

      cookieStore.set('b2b_auth_session', encodeURIComponent(JSON.stringify({
        id: confirmedUserId || targetUser?.id || `usr_${Date.now()}`,
        email: rawEmail,
        username: targetUser?.user_metadata?.username,
        role: finalRole,
        tier: finalTier,
        approval_status: finalStatus,
        companyName: finalCompName,
        contactName: finalContactName,
        companyId: companyRecord?.id || confirmedUserId || `comp_${Date.now()}`,
      })), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } catch (cookieErr) {
      console.warn('[VERIFY CODE SESSION COOKIE NOTICE]', cookieErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code validated successfully.',
      userId: confirmedUserId,
      user: targetUser || {
        id: confirmedUserId || `usr_${Date.now()}`,
        email: rawEmail,
        user_metadata: { role: 'seller', approval_status: 'pending', membership_tier: 'bronze' },
      },
      company: companyRecord || {
        id: confirmedUserId || `comp_${Date.now()}`,
        contact_email: rawEmail,
        role: 'seller',
        approval_status: 'pending',
        tier: 'bronze',
      },
    });
  } catch (err) {
    console.error('[VERIFY CODE EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying code.' },
      { status: 500 }
    );
  }
}

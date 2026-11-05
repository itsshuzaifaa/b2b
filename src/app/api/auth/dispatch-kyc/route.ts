import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { sendKycVerificationRequestEmail } from '@/lib/email/dispatcher';
import {
  isKycAlreadyDispatched,
  markKycDispatched,
} from '@/lib/email/kyc-cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = (body.email || '').trim().toLowerCase();

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    // 1. Strict deduplication check: If already dispatched, NEVER send duplicate email
    if (isKycAlreadyDispatched(rawEmail)) {
      return NextResponse.json({
        success: true,
        alreadyDispatched: true,
        message: 'KYC documents email already dispatched.',
      });
    }

    let userMeta: any = {};
    let targetUser: any = null;
    let company: any = null;

    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        const { data: comp } = await admin
          .from('companies')
          .select('*')
          .ilike('contact_email', rawEmail)
          .maybeSingle();
        company = comp;

        const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        targetUser = usersList?.users?.find(
          (u: any) => u.email?.toLowerCase().trim() === rawEmail
        );
        userMeta = targetUser?.user_metadata || {};

        if (userMeta.kyc_dispatched) {
          markKycDispatched(rawEmail);
          return NextResponse.json({
            success: true,
            alreadyDispatched: true,
            message: 'KYC documents email already dispatched.',
          });
        }
      } catch (dbErr) {
        console.warn('[KYC DISPATCH DB CHECK NOTICE]', dbErr);
      }
    }

    // Immediately mark dispatched to block rapid concurrent triggers
    markKycDispatched(rawEmail);

    const effectiveCompanyName =
      company?.company_name ||
      company?.name ||
      userMeta.company_name ||
      userMeta.contact_name ||
      'Wholesale Trading Partner';

    const effectiveContactName =
      company?.contact_name ||
      userMeta.contact_name ||
      `${userMeta.first_name || ''} ${userMeta.last_name || ''}`.trim() ||
      'Valued Partner';

    const effectivePhone = company?.phone || userMeta.phone || null;
    const effectiveAddress = company?.address || userMeta.address || null;

    // 2. Dispatch Business Verification Request email (single send)
    const emailResult = await sendKycVerificationRequestEmail(rawEmail, {
      companyName: effectiveCompanyName,
      contactName: effectiveContactName,
      email: rawEmail,
      phone: effectivePhone,
      address: effectiveAddress,
    });

    // 3. Mark kyc_dispatched in user metadata and database
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        if (targetUser?.id) {
          await admin.auth.admin.updateUserById(targetUser.id, {
            user_metadata: {
              ...userMeta,
              kyc_dispatched: true,
              email_verified_at: new Date().toISOString(),
              approval_status: 'pending',
            },
          });
        }

        if (company?.id) {
          await admin
            .from('companies')
            .update({
              approval_status: 'pending',
            })
            .eq('id', company.id);
        }
      } catch (persistErr) {
        console.warn('[KYC PERSIST NOTICE]', persistErr);
      }
    }

    return NextResponse.json({
      success: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error,
    });
  } catch (err) {
    console.error('[/api/auth/dispatch-kyc EXCEPTION]', err);
    return NextResponse.json(
      { error: 'Failed to dispatch KYC verification email.' },
      { status: 500 }
    );
  }
}

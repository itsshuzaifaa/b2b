import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendVerificationEmail } from '@/lib/email/dispatcher';
import { getDynamicAppUrl, sanitizeActionUrl } from '@/lib/utils/app-url';
import { saveVerificationCode } from '@/lib/auth/verification-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const username = (body.username || '').trim().toLowerCase();
    const firstName = (body.firstName || '').trim();
    const lastName = (body.lastName || '').trim();
    const contactName = `${firstName} ${lastName}`.trim();
    const phone = (body.phone || '').trim();
    const address = (body.address || '').trim();
    const companyName = (body.companyName || '').trim();
    const regNumber = (body.regNumber || '').trim();
    const vatNumber = (body.vatNumber || '').trim();
    const role = 'seller'; // Unified trading role for both buying and selling
    const membershipTier = body.membershipTier || 'bronze';
    const selectedNiches: string[] = Array.isArray(body.selectedNiches) ? body.selectedNiches : [];

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid corporate email.' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    if (!username) {
      return NextResponse.json({ error: 'Please enter a username.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const appUrl = await getDynamicAppUrl(request);
    const redirectUrl = `${appUrl}/auth/callback`;

    // 0. Clean up any previous unverified registration attempts with this email or username
    // Ensures usernames are NOT locked in unless email is verified!
    try {
      const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUsers = usersList?.users || [];
      for (const u of existingUsers) {
        const uMetaUsername = (u.user_metadata?.username as string | undefined)?.toLowerCase();
        if (!u.email_confirmed_at && (u.email?.toLowerCase() === email || uMetaUsername === username)) {
          await admin.auth.admin.deleteUser(u.id);
          await admin.from('companies').delete().eq('user_id', u.id);
          await admin.from('product_inquiries').delete().eq('buyer_email', email);
          await admin.from('wtb_requests').delete().eq('buyer_email', email);
        }
      }
    } catch (cleanupErr) {
      console.warn('[PRE-REGISTER CLEANUP NOTICE]', cleanupErr);
    }

    // 1. Create user in Supabase Auth via Admin API
    let userId: string | null = null;
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        username,
        first_name: firstName,
        last_name: lastName,
        contact_name: contactName,
        phone,
        address,
        company_name: companyName || contactName || `${firstName} ${lastName}`.trim(),
        role: 'seller',
        membership_tier: membershipTier || 'bronze',
        approval_status: 'pending',
        agreed_to_terms: true,
        terms_agreed_at: new Date().toISOString(),
      },
    });

    if (createError) {
      if (createError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please sign in.' },
          { status: 409 }
        );
      }
      console.error('[REGISTER USER ERROR]', createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    userId = userData?.user?.id || null;

    // 2. Insert Company Record
    const categoryUuidMap: Record<string, string> = {
      'consumer-electronics': '0e07e810-fb76-4431-ba0f-6d98d6be357c',
      'beauty-cosmetics': '37a3df9d-be14-46bd-94eb-8a71e901d5d8',
      'home-kitchen': 'a01e05fd-cc4f-49a5-9acd-0cdf17b05cbc',
      'apparel-footwear': 'b287c6e6-5198-44d6-a101-033ee85d6e98',
      'toys-games': 'a35443f8-8ace-46fe-942f-4d272874e48e',
      'health-fmcg': '707bad1a-eeab-466d-970c-87403b22307e',
      'tools-hardware': 'b287c6e6-5198-44d6-a101-033ee85d6e98',
    };
    const validCategoryUuids = selectedNiches
      .map((n) => categoryUuidMap[n] || (n.length === 36 ? n : null))
      .filter((id): id is string => Boolean(id));

    // All newly registered accounts begin on bronze (free). Paid tiers (Silver/Gold)
    // are only activated after successful email verification AND successful card payment,
    // ensuring no user is charged without an active, verified account or granted paid access on cancel.
    const approvalStatus = 'pending';
    const effectiveCompanyName = companyName || contactName || `${firstName} ${lastName}`.trim() || 'Wholesale Member';
    const effectiveTier = 'bronze';

    const { data: compInsert, error: compInsertError } = await admin.from('companies').insert({
      user_id: userId,
      company_name: effectiveCompanyName,
      company_number: regNumber || null,
      vat_number: vatNumber || null,
      contact_name: contactName,
      contact_email: email,
      phone: phone || null,
      role: 'seller',
      approval_status: approvalStatus,
      tier: effectiveTier,
      niches: selectedNiches,
    }).select('id').single();

    if (compInsertError) {
      console.error('[REGISTER COMPANY INSERT ERROR]', compInsertError);
    }

    const companyId = compInsert?.id || userId;

    // 2.3 Onboarding is presented via the interactive App Walkthrough Modal upon login,
    // rather than an automated chat message from Jeff / Support.
    // (Per user requirement: replaced auto welcome chat with interactive onboarding tour)

    // 2.5 Save to Admin Campaign Leads (Email & WhatsApp list for future outreach campaigns)
    try {
      const { recordNewCampaignLead } = await import('@/lib/campaigns/campaign-store');
      await recordNewCampaignLead({
        email,
        whatsapp: phone,
        contactName: contactName || `${firstName} ${lastName}`.trim(),
        companyName: effectiveCompanyName,
        role,
        tier: role === 'seller' ? membershipTier : 'bronze',
        country: 'Global',
      });
    } catch (leadErr) {
      console.warn('[CAMPAIGN LEAD RECORDING NOTICE]', leadErr);
    }

    // 3. Generate verification OTP & Link
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError || !linkData?.properties) {
      console.error('[REGISTER GENERATE LINK ERROR]', linkError);
    }

    const otpCode = linkData?.properties?.email_otp || '';
    const rawActionLink = linkData?.properties?.action_link;
    const actionUrl = rawActionLink
      ? sanitizeActionUrl(rawActionLink, appUrl)
      : `${appUrl}/verify-email?email=${encodeURIComponent(email)}`;

    // 4. Dispatch the ONE official branded B2B LINK verification email via Resend
    if (otpCode) {
      saveVerificationCode(email, otpCode);

      const emailResult = await sendVerificationEmail(email, {
        recipientEmail: email,
        contactName: firstName || contactName || undefined,
        otpCode,
        actionUrl,
      });

      if (!emailResult.success) {
        console.warn('[REGISTER EMAIL DISPATCH NOTICE]', emailResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      email,
      role,
      companyId,
      userId,
    });
  } catch (err) {
    console.error('[REGISTER EXCEPTION]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
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
    const contactName = `${firstName} ${lastName}`.trim() || 'Wholesale Member';
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

    const appUrl = await getDynamicAppUrl(request);
    const redirectUrl = `${appUrl}/auth/callback`;
    let actionUrl = `${appUrl}/verify-email?email=${encodeURIComponent(email)}`;
    
    // Default robust fallback identifiers
    let userId: string = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const effectiveCompanyName = companyName || contactName || `${firstName} ${lastName}`.trim() || 'Wholesale Member';
    const effectiveTier = 'bronze';
    const approvalStatus = 'pending';
    let companyId: string = `comp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    let otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Attempt Supabase Auth & DB operations if available
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();

        if (admin) {
        // 0. Clean up any previous unverified registration attempts with this email or username
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
        try {
          const { data: userData, error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Allow user to sign in immediately so they land on dashboard with verification modal
            user_metadata: {
              username,
              first_name: firstName,
              last_name: lastName,
              contact_name: contactName,
              phone,
              address,
              company_name: effectiveCompanyName,
              role: 'seller',
              membership_tier: membershipTier || 'bronze',
              approval_status: 'pending',
              agreed_to_terms: true,
              terms_agreed_at: new Date().toISOString(),
            },
          });

          if (createError) {
            if (createError.message?.toLowerCase().includes('already registered')) {
              return NextResponse.json(
                { error: 'An account with this email address already exists. Please sign in.' },
                { status: 409 }
              );
            }
            console.warn('[REGISTER USER NOTICE]', createError.message);
          } else if (userData?.user?.id) {
            userId = userData.user.id;
          }
        } catch (createErr: any) {
          console.warn('[REGISTER SUPABASE CREATE USER EXCEPTION]', createErr?.message || createErr);
        }

        // 2. Insert Company Record
        try {
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
          }).select('id').maybeSingle();

          if (compInsert?.id) {
            companyId = compInsert.id;
          }
          if (compInsertError) {
            console.warn('[REGISTER COMPANY INSERT NOTICE]', compInsertError.message);
          }
        } catch (compErr: any) {
          console.warn('[REGISTER COMPANY INSERT EXCEPTION]', compErr?.message || compErr);
        }

        // 2.3 Send Automated Welcome Message from B2B LINK Support Team
        try {
          const { data: adminComp } = await admin.from('companies').select('id').eq('role', 'admin').maybeSingle();
          const adminCompanyId = adminComp?.id || 'facbb93f-080f-480f-b54b-8ef26664da86';
          const deskProductId = '00000000-0000-4000-a000-000000000001';

          const userDisplayName = firstName || contactName || 'there';
          const welcomeText = `Hello ${userDisplayName},

Welcome to B2B LINK.

B2B LINK is designed to make wholesale trading faster and simpler.

You can use the platform to:
• Browse live BUY and SELL listings
• Post what you have available or what you need
• Receive relevant Buyer-Seller Matches
• Search by product, EAN/UPC or item code
• Connect directly with other members

If you need any assistance, our Support Team is here to help.

Welcome to the network.

Kind regards,
B2B LINK Support Team`;

          const welcomeThread = [
            {
              id: `welcome-${Date.now()}`,
              senderId: adminCompanyId,
              senderName: 'B2B LINK Support Team',
              senderRole: 'admin',
              text: welcomeText,
              timestamp: new Date().toISOString(),
              isRead: false,
              isBroadcast: false,
            },
          ];

          await admin.from('product_inquiries').insert({
            product_id: deskProductId,
            seller_company_id: adminCompanyId,
            buyer_name: contactName || userDisplayName,
            buyer_email: email,
            buyer_company: effectiveCompanyName,
            buyer_phone: phone || null,
            requested_quantity: 1,
            target_price: 0,
            message: JSON.stringify(welcomeThread),
            status: 'admin_desk',
          });
        } catch (welcomeErr) {
          console.warn('[WELCOME MESSAGE DISPATCH NOTICE]', welcomeErr);
        }

        // 3. Generate verification OTP & Link from Supabase
        try {
          const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: {
              redirectTo: redirectUrl,
            },
          });

          if (!linkError && linkData?.properties) {
            if (linkData.properties.email_otp) {
              otpCode = linkData.properties.email_otp;
            }
            if (linkData.properties.action_link) {
              actionUrl = sanitizeActionUrl(linkData.properties.action_link, appUrl);
            }
          }
        } catch (linkErr) {
          console.warn('[REGISTER GENERATE LINK EXCEPTION]', linkErr);
        }
      }
    } catch (supabaseErr) {
      console.warn('[SUPABASE SERVICE NOTICE - CONTINUING WITH RESILIENT REGISTRATION]', supabaseErr);
    }
  }

    // 4. Always register active OTP in memory (valid for 15 minutes)
    saveVerificationCode(email, otpCode);

    // 5. Dispatch branded B2B LINK verification email via Resend
    try {
      const emailResult = await sendVerificationEmail(email, {
        recipientEmail: email,
        contactName: firstName || contactName || undefined,
        otpCode,
        actionUrl,
      });

      if (!emailResult.success) {
        console.warn('[REGISTER EMAIL DISPATCH NOTICE]', emailResult.error);
      }
    } catch (emailErr) {
      console.warn('[REGISTER EMAIL EXCEPTION NOTICE]', emailErr);
    }

    // 6. Save to Admin Campaign Leads
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

        // 7. Record user in server registry so login works seamlessly with both username and email
    try {
      const { registerUserAccount } = await import('@/lib/auth/user-registry');
      registerUserAccount({
        id: userId,
        email: email.trim().toLowerCase(),
        username: username,
        plainPassword: password,
        firstName,
        lastName,
        contactName: contactName || `${firstName} ${lastName}`.trim(),
        companyName: effectiveCompanyName,
        companyId,
        phone,
        role: 'seller',
        tier: (membershipTier as any) || 'bronze',
        approval_status: 'pending',
        emailConfirmed: false,
        createdAt: new Date().toISOString(),
      });
    } catch (regErr) {
      console.warn('[USER REGISTRY NOTICE]', regErr);
    }

    // 8. Set persistent session cookie so mobile and multi-lambda requests immediately recognize session
    try {
      const cookieStore = await cookies();
      cookieStore.set('b2b_auth_session', encodeURIComponent(JSON.stringify({
        id: userId,
        email: email.trim().toLowerCase(),
        username,
        role: 'seller',
        tier: (membershipTier as any) || 'bronze',
        approval_status: 'pending',
        companyName: effectiveCompanyName,
        contactName: contactName || `${firstName} ${lastName}`.trim(),
        companyId,
      })), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } catch (cookieErr) {
      console.warn('[REGISTER SESSION COOKIE NOTICE]', cookieErr);
    }

    return NextResponse.json({
      success: true,
      email,
      role,
      companyId: companyId || userId,
      userId: userId || companyId,
    });
  } catch (err: any) {
    console.error('[REGISTER EXCEPTION]', err);
    return NextResponse.json(
      { error: err?.message || 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

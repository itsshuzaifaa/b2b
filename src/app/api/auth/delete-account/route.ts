import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendAccountDeletionConfirmationEmail } from '@/lib/email/dispatcher';

export async function POST(req: NextRequest) {
  // 1. Rate limiting (fail closed)
  const rateLimitResponse = await enforceRateLimit(req, 'delete-account');
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Authentication guard: must be authenticated user session
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // 3. Admin guard: Admins cannot delete themselves via self-service
  const userEmail = (auth.user.email || '').toLowerCase().trim();
  const companyRole = auth.company?.role?.toLowerCase();
  if (auth.isAdmin || companyRole === 'admin' || userEmail === 'admin@b2blink.eu') {
    return NextResponse.json(
      { error: 'Platform admin accounts cannot be deleted through self-service.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Current password is required to confirm account deletion.', code: 'PASSWORD_REQUIRED' },
        { status: 400 }
      );
    }

    // 4. Server-side password re-verification using non-persistent client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Server authentication configuration missing.', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const verificationClient = createSupabaseClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { error: verifyErr } = await verificationClient.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (verifyErr) {
      return NextResponse.json(
        { error: 'Incorrect password. Account deletion requires valid password verification.', code: 'INVALID_PASSWORD' },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const callerUserId = auth.user.id;

    // 5. Locate caller's company strictly by callerUserId (never from request body)
    const { data: targetCompanies, error: fetchErr } = await admin
      .from('companies')
      .select('id, user_id, role, contact_email, company_name, contact_name')
      .or(`id.eq.${callerUserId},user_id.eq.${callerUserId}`);

    if (fetchErr) {
      console.error('[DELETE ACCOUNT FETCH COMPANIES ERROR]', fetchErr);
      return NextResponse.json(
        { error: 'Failed to retrieve account records.', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    // Guard again on any fetched company
    if (
      targetCompanies?.some(
        (c) => c.role === 'admin' || c.contact_email?.toLowerCase() === 'admin@b2blink.eu'
      )
    ) {
      return NextResponse.json(
        { error: 'Platform admin accounts cannot be deleted.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const targetCompanyIds = new Set<string>();
    const targetUserIds = new Set<string>([callerUserId]);
    const candidateEmails = new Set<string>([userEmail]);

    if (auth.company?.id) {
      targetCompanyIds.add(auth.company.id);
      if (auth.company.contact_email) candidateEmails.add(auth.company.contact_email.toLowerCase().trim());
    }

    if (targetCompanies && targetCompanies.length > 0) {
      for (const c of targetCompanies) {
        if (c.id) targetCompanyIds.add(c.id);
        if (c.user_id) targetUserIds.add(c.user_id);
        if (c.contact_email) candidateEmails.add(c.contact_email.toLowerCase().trim());
      }
    }

    const emailList = Array.from(candidateEmails).filter(Boolean);
    const primaryContactName = auth.company?.contact_name || targetCompanies?.[0]?.contact_name || 'Member';
    const primaryCompanyName = auth.company?.company_name || targetCompanies?.[0]?.company_name || 'Organization';

    // 6. Anonymize chat messages & inquiries in conversations with other traders
    for (const email of emailList) {
      const { data: buyerInqs, error: inqFindErr } = await admin
        .from('product_inquiries')
        .select('id, message')
        .ilike('buyer_email', email);

      if (!inqFindErr && buyerInqs && buyerInqs.length > 0) {
        for (const inq of buyerInqs) {
          let updatedMessage = inq.message;
          try {
            const parsed = JSON.parse(inq.message);
            if (Array.isArray(parsed)) {
              const anonymized = parsed.map((m: any) => {
                const isFromThisUser =
                  m.senderRole === 'buyer' ||
                  m.senderId === callerUserId ||
                  (m.senderId && emailList.includes(String(m.senderId).toLowerCase())) ||
                  m.senderName === primaryContactName;

                if (isFromThisUser) {
                  return {
                    ...m,
                    senderName: 'Deleted user',
                    senderId: 'deleted-user',
                  };
                }
                return m;
              });
              updatedMessage = JSON.stringify(anonymized);
            }
          } catch {
            // Keep original string if not JSON
          }

          await admin
            .from('product_inquiries')
            .update({
              buyer_name: 'Deleted user',
              buyer_company: 'Deleted user',
              buyer_email: 'deleted-user@b2blink.internal',
              buyer_phone: null,
              message: updatedMessage,
            })
            .eq('id', inq.id);
        }
      }

      // Anonymize customer queries submitted by this user
      await admin
        .from('customer_queries')
        .update({
          name: 'Deleted user',
          company: 'Deleted user',
          email: 'deleted-user@b2blink.internal',
          phone: null,
        })
        .ilike('email', email);
    }

    // 7. Cascade delete caller's own products, quotations, notifications, inquiries, and company records
    for (const tId of targetCompanyIds) {
      const { error: prodErr } = await admin.from('products').delete().eq('company_id', tId);
      if (prodErr) {
        console.error(`[DELETE ACCOUNT] Error deleting products for company ${tId}:`, prodErr);
      }

      const { error: quoteErr } = await admin.from('quotations').delete().eq('seller_company_id', tId);
      if (quoteErr) {
        console.error(`[DELETE ACCOUNT] Error deleting quotations for company ${tId}:`, quoteErr);
      }

      const { error: queueErr } = await admin.from('wtb_notifications_queue').delete().eq('seller_company_id', tId);
      if (queueErr) {
        console.error(`[DELETE ACCOUNT] Error deleting notifications for company ${tId}:`, queueErr);
      }

      const { error: inqSellerErr } = await admin.from('product_inquiries').delete().eq('seller_company_id', tId);
      if (inqSellerErr) {
        console.error(`[DELETE ACCOUNT] Error deleting seller inquiries for company ${tId}:`, inqSellerErr);
      }

      const { error: payErr } = await admin.from('payments').delete().eq('company_id', tId);
      if (payErr && !payErr.message?.includes('schema cache') && payErr.code !== '42P01' && payErr.code !== 'PGRST205') {
        console.error(`[DELETE ACCOUNT] Error deleting payments for company ${tId}:`, payErr);
      }

      const { error: compErr } = await admin.from('companies').delete().eq('id', tId);
      if (compErr) {
        console.error(`[DELETE ACCOUNT] Error deleting company ${tId}:`, compErr);
      }
    }

    // 8. Cascade delete caller's WTB requests and company references by user_id
    for (const uId of targetUserIds) {
      const { error: wtbErr } = await admin.from('wtb_requests').delete().eq('buyer_user_id', uId);
      if (wtbErr) {
        console.error(`[DELETE ACCOUNT] Error deleting WTB requests for user ${uId}:`, wtbErr);
      }

      const { error: compUserErr } = await admin.from('companies').delete().eq('user_id', uId);
      if (compUserErr) {
        console.error(`[DELETE ACCOUNT] Error deleting company by user_id ${uId}:`, compUserErr);
      }
    }

    // 9. Send confirmation email to user's address before deleting Auth user
    try {
      await sendAccountDeletionConfirmationEmail(userEmail, {
        contactName: primaryContactName,
        companyName: primaryCompanyName,
      });
    } catch (mailErr) {
      console.warn('[DELETE ACCOUNT CONFIRMATION EMAIL WARNING]', mailErr);
    }

    // 10. Delete Supabase Auth user identity
    const { error: authDelErr } = await admin.auth.admin.deleteUser(callerUserId);
    if (authDelErr && !authDelErr.message?.toLowerCase().includes('not found')) {
      console.error(`[DELETE ACCOUNT] Error deleting auth user ${callerUserId}:`, authDelErr);
    }

    // 11. Clear session cookies on response
    const cookieStore = await cookies();
    cookieStore.getAll().forEach((c) => {
      if (c.name.includes('supabase') || c.name.includes('sb-') || c.name.includes('auth')) {
        cookieStore.delete(c.name);
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Account successfully deleted.',
    });
  } catch (err: any) {
    console.error('[DELETE ACCOUNT UNHANDLED ERROR]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to process account deletion.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

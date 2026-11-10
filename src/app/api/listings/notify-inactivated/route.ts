import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { sendListingInactivatedEmail } from '@/lib/email/dispatcher';
import { getDynamicAppUrl } from '@/lib/utils/app-url';
import { createAdminClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

interface InactivatedNotificationPayload {
  email?: string;
  recipientName?: string;
  companyName?: string;
  listingTitle: string;
  itemCode?: string;
  category?: string;
  unitPrice?: number;
  unpublishedDate?: string;
  recoveryDaysLeft?: number;
  permanentDeleteDate?: string;
}

/**
 * POST /api/listings/notify-inactivated
 * Dispatches notification emails when listings reach their 14-day duration limit.
 * 
 * SECURITY MANDATE:
 * 1. Requires authenticated user session via requireUser().
 * 2. Non-admins can ONLY trigger notifications to their own verified company email.
 * 3. Verified listing ownership: non-admins cannot send notifications on behalf of other companies.
 */
export async function POST(req: NextRequest) {
  const rateLimitRes = await enforceRateLimit(req, 'notify-inactivated');
  if (rateLimitRes) return rateLimitRes;

  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized: Authentication required.' },
      { status: 401 }
    );
  }

  if (!auth.isAdmin && !auth.company) {
    return NextResponse.json(
      { error: 'Forbidden: No registered company found for your user account.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { items, email, recipientName, companyName, listingTitle, itemCode, category, unitPrice, unpublishedDate } = body || {};

    const baseUrl = await getDynamicAppUrl();
    const actionUrl = `${baseUrl}/dashboard/listings?tab=unpublished`;

    // Support single item or batch array of notifications
    const notifications: InactivatedNotificationPayload[] = Array.isArray(items)
      ? items
      : listingTitle
      ? [{ email, recipientName, companyName, listingTitle, itemCode, category, unitPrice, unpublishedDate }]
      : [];

    if (!notifications.length) {
      return NextResponse.json(
        { success: false, error: 'Listing title is required.' },
        { status: 400 }
      );
    }

    const callerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();
    const callerCompanyName = auth.company?.company_name || auth.company?.name || 'Wholesale Partner';
    const callerContactName = auth.company?.contact_name || 'Wholesale Partner';

    // Verify listing ownership: non-admins can only trigger notifications for listings belonging to their own company
    if (!auth.isAdmin && auth.company) {
      const admin = createAdminClient();
      for (const notif of notifications) {
        const title = notif.listingTitle?.trim();
        if (!title) continue;

        const { data: ownedProduct } = await admin
          .from('products')
          .select('id, company_id')
          .eq('company_id', auth.company.id)
          .ilike('title', title)
          .maybeSingle();

        if (!ownedProduct) {
          return NextResponse.json(
            { error: `Forbidden: You do not own listing "${title}".`, code: 'FORBIDDEN_NOT_OWNER' },
            { status: 403 }
          );
        }
      }
    }

    const results = [];
    for (const notif of notifications) {
      if (!notif.listingTitle?.trim()) continue;

      // Non-admins can NEVER target another email address
      const targetEmail = auth.isAdmin && notif.email
        ? notif.email.trim().toLowerCase()
        : callerEmail;

      const effectiveRecipientName = auth.isAdmin
        ? (notif.recipientName || 'Wholesale Partner')
        : callerContactName;

      const effectiveCompanyName = auth.isAdmin
        ? (notif.companyName || 'Wholesale Partner')
        : callerCompanyName;

      const deleteDate = notif.permanentDeleteDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      })();

      const unpubDate = notif.unpublishedDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const res = await sendListingInactivatedEmail(targetEmail, {
        recipientName: effectiveRecipientName,
        companyName: effectiveCompanyName,
        listingTitle: notif.listingTitle.trim(),
        itemCode: notif.itemCode,
        category: notif.category,
        unitPrice: notif.unitPrice,
        unpublishedDate: unpubDate,
        recoveryDaysLeft: notif.recoveryDaysLeft ?? 30,
        permanentDeleteDate: deleteDate,
        actionUrl,
      });

      results.push({ email: targetEmail, listingTitle: notif.listingTitle, success: res.success, error: res.error });
    }

    return NextResponse.json({
      success: true,
      sentCount: results.filter((r) => r.success).length,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error('[NOTIFY INACTIVATED LISTINGS ERROR]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to send inactivation notification' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sendListingInactivatedEmail } from '@/lib/email/dispatcher';
import { getDynamicAppUrl } from '@/lib/utils/app-url';

interface InactivatedNotificationPayload {
  email: string;
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, email, recipientName, companyName, listingTitle, itemCode, category, unitPrice, unpublishedDate } = body || {};

    const baseUrl = await getDynamicAppUrl();
    const actionUrl = `${baseUrl}/dashboard/listings?tab=unpublished`;

    // Support single item or batch array of notifications
    const notifications: InactivatedNotificationPayload[] = Array.isArray(items)
      ? items
      : email && listingTitle
      ? [{ email, recipientName, companyName, listingTitle, itemCode, category, unitPrice, unpublishedDate }]
      : [];

    if (!notifications.length) {
      return NextResponse.json(
        { success: false, error: 'Recipient email and listingTitle are required.' },
        { status: 400 }
      );
    }

    const results = [];
    for (const notif of notifications) {
      if (!notif.email || !notif.listingTitle) continue;

      const deleteDate = notif.permanentDeleteDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      })();

      const unpubDate = notif.unpublishedDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const res = await sendListingInactivatedEmail(notif.email, {
        recipientName: notif.recipientName || 'Wholesale Partner',
        companyName: notif.companyName,
        listingTitle: notif.listingTitle,
        itemCode: notif.itemCode,
        category: notif.category,
        unitPrice: notif.unitPrice,
        unpublishedDate: unpubDate,
        recoveryDaysLeft: notif.recoveryDaysLeft ?? 30,
        permanentDeleteDate: deleteDate,
        actionUrl,
      });

      results.push({ email: notif.email, listingTitle: notif.listingTitle, success: res.success, error: res.error });
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

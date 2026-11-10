import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyCronOrAdmin } from '@/lib/auth/guards';
import {
  LISTING_ACTIVE_DURATION_DAYS,
  LISTING_RECOVERY_WINDOW_DAYS,
  MS_PER_DAY,
  processListingsLifecycle,
  type LifecycleListingItem,
} from '@/lib/listings/lifecycle';
import { sendListingInactivatedEmail } from '@/lib/email/dispatcher';
import { getDynamicAppUrl } from '@/lib/utils/app-url';

export async function POST(req: NextRequest) {
  const isAuthorized = await verifyCronOrAdmin(req);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid cron secret or admin credentials.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { listings, companyId, companyEmail, contactName, companyName } = body || {};

    const baseUrl = await getDynamicAppUrl();
    const actionUrl = `${baseUrl}/dashboard/listings?tab=unpublished`;

    let processedListings = listings;
    let newlyUnpublished: LifecycleListingItem[] = [];
    let permanentlyDeletedCount = 0;
    let emailsSent = 0;

    // 1. Process client-provided listings (if passed)
    if (Array.isArray(listings) && listings.length > 0) {
      const result = processListingsLifecycle(listings);
      processedListings = result.updatedListings;
      newlyUnpublished = result.newlyUnpublished;
      permanentlyDeletedCount = result.permanentlyDeletedCount;

      // Send emails for newly unpublished listings
      const targetEmail = companyEmail;
      if (targetEmail && newlyUnpublished.length > 0) {
        for (const item of newlyUnpublished) {
          if (item.unpublishNotificationSent) continue;

          const deleteDate = (() => {
            const d = new Date();
            d.setDate(d.getDate() + LISTING_RECOVERY_WINDOW_DAYS);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          })();

          try {
            await sendListingInactivatedEmail(targetEmail, {
              recipientName: contactName || companyName || 'Wholesale Partner',
              companyName,
              listingTitle: item.title,
              itemCode: item.itemCode,
              category: item.category,
              unitPrice: item.unitPrice,
              unpublishedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
              recoveryDaysLeft: LISTING_RECOVERY_WINDOW_DAYS,
              permanentDeleteDate: deleteDate,
              actionUrl,
            });
            item.unpublishNotificationSent = true;
            emailsSent++;
          } catch (emailErr) {
            console.warn('[EMAIL DISPATCH WARNING]', emailErr);
          }
        }
      }
    }

    // 2. Synchronize with Supabase database (if available)
    let dbUnpublishedCount = 0;
    let dbDeletedCount = 0;

    try {
      const admin = createAdminClient();
      const now = Date.now();
      const fourteenDaysAgo = new Date(now - LISTING_ACTIVE_DURATION_DAYS * MS_PER_DAY).toISOString();
      const thirtyDaysAgo = new Date(now - LISTING_RECOVERY_WINDOW_DAYS * MS_PER_DAY).toISOString();

      // Query active products older than 14 days
      let activeQuery = admin
        .from('products')
        .select('*, company:companies(id, contact_name, company_name, email, contact_email)')
        .eq('status', 'active')
        .lt('created_at', fourteenDaysAgo);

      if (companyId) {
        activeQuery = activeQuery.eq('company_id', companyId);
      }

      const { data: expiredActiveProducts } = await activeQuery;

      if (expiredActiveProducts && expiredActiveProducts.length > 0) {
        const expiredIds = expiredActiveProducts.map((p) => p.id);

        // Update them to inactive/unpublished
        const { error: updateErr } = await admin
          .from('products')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString(),
          })
          .in('id', expiredIds);

        if (!updateErr) {
          dbUnpublishedCount = expiredIds.length;

          // Dispatch email notifications to their companies
          for (const prod of expiredActiveProducts) {
            const sellerEmail = prod.company?.contact_email || prod.company?.email;
            if (sellerEmail) {
              const deleteDate = (() => {
                const d = new Date();
                d.setDate(d.getDate() + LISTING_RECOVERY_WINDOW_DAYS);
                return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              })();

              try {
                await sendListingInactivatedEmail(sellerEmail, {
                  recipientName: prod.company?.contact_name || prod.company?.company_name || 'Wholesale Partner',
                  companyName: prod.company?.company_name || undefined,
                  listingTitle: prod.title,
                  itemCode: prod.barcode_or_sku || undefined,
                  category: prod.category_slug,
                  unitPrice: Number(prod.unit_price) || 0,
                  unpublishedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                  recoveryDaysLeft: LISTING_RECOVERY_WINDOW_DAYS,
                  permanentDeleteDate: deleteDate,
                  actionUrl,
                });
                emailsSent++;
              } catch (eErr) {
                console.warn('[DB PROD INACTIVATION EMAIL WARNING]', eErr);
              }
            }
          }
        }
      }

      // Query unpublished/inactive products older than 30 days -> permanently delete
      let unpublishedQuery = admin
        .from('products')
        .select('id')
        .in('status', ['inactive', 'unpublished'])
        .lt('updated_at', thirtyDaysAgo);

      if (companyId) {
        unpublishedQuery = unpublishedQuery.eq('company_id', companyId);
      }

      const { data: permanentlyExpiredProducts } = await unpublishedQuery;

      if (permanentlyExpiredProducts && permanentlyExpiredProducts.length > 0) {
        const purgeIds = permanentlyExpiredProducts.map((p) => p.id);
        const { error: deleteErr } = await admin.from('products').delete().in('id', purgeIds);
        if (!deleteErr) {
          dbDeletedCount = purgeIds.length;
        }
      }
    } catch {
      // Supabase not configured or in client-mock environment
    }

    return NextResponse.json({
      success: true,
      updatedListings: processedListings,
      newlyUnpublishedCount: newlyUnpublished.length,
      permanentlyDeletedCount: permanentlyDeletedCount + dbDeletedCount,
      dbUnpublishedCount,
      emailsSent,
    });
  } catch (err) {
    console.error('[LIFECYCLE PROCESS EXCEPTION]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Lifecycle processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const isAuthorized = await verifyCronOrAdmin(req);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid cron secret or admin credentials.' },
      { status: 401 }
    );
  }

  // Cron / periodic trigger for database-level expiry
  try {
    const admin = createAdminClient();
    const now = Date.now();
    const fourteenDaysAgo = new Date(now - LISTING_ACTIVE_DURATION_DAYS * MS_PER_DAY).toISOString();
    const thirtyDaysAgo = new Date(now - LISTING_RECOVERY_WINDOW_DAYS * MS_PER_DAY).toISOString();

    const baseUrl = await getDynamicAppUrl();
    const actionUrl = `${baseUrl}/dashboard/listings?tab=unpublished`;
    let emailsSent = 0;

    // 1. Unpublish active products older than 14 days
    const { data: expiredActive } = await admin
      .from('products')
      .select('*, company:companies(id, contact_name, company_name, email, contact_email)')
      .eq('status', 'active')
      .lt('created_at', fourteenDaysAgo);

    let unpublishedCount = 0;
    if (expiredActive && expiredActive.length > 0) {
      const ids = expiredActive.map((p) => p.id);
      await admin.from('products').update({ status: 'inactive', updated_at: new Date().toISOString() }).in('id', ids);
      unpublishedCount = ids.length;

      for (const prod of expiredActive) {
        const sellerEmail = prod.company?.contact_email || prod.company?.email;
        if (sellerEmail) {
          const deleteDate = (() => {
            const d = new Date();
            d.setDate(d.getDate() + LISTING_RECOVERY_WINDOW_DAYS);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          })();

          try {
            await sendListingInactivatedEmail(sellerEmail, {
              recipientName: prod.company?.contact_name || prod.company?.company_name || 'Wholesale Partner',
              companyName: prod.company?.company_name || undefined,
              listingTitle: prod.title,
              itemCode: prod.barcode_or_sku || undefined,
              category: prod.category_slug,
              unitPrice: Number(prod.unit_price) || 0,
              unpublishedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
              recoveryDaysLeft: LISTING_RECOVERY_WINDOW_DAYS,
              permanentDeleteDate: deleteDate,
              actionUrl,
            });
            emailsSent++;
          } catch {}
        }
      }
    }

    // 2. Permanently delete products unpublished for > 30 days
    const { data: expiredUnpublished } = await admin
      .from('products')
      .select('id')
      .in('status', ['inactive', 'unpublished'])
      .lt('updated_at', thirtyDaysAgo);

    let deletedCount = 0;
    if (expiredUnpublished && expiredUnpublished.length > 0) {
      const ids = expiredUnpublished.map((p) => p.id);
      await admin.from('products').delete().in('id', ids);
      deletedCount = ids.length;
    }

    return NextResponse.json({
      success: true,
      unpublishedCount,
      permanentlyDeletedCount: deletedCount,
      emailsSent,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Cron lifecycle check skipped (Supabase unavailable)',
    });
  }
}

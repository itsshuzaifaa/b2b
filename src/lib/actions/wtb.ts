'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { processWtbNotificationQueue } from '@/lib/email/dispatcher';
import type { WtbRequest } from '@/types/database';

export interface WtbInput {
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerCompany?: string;
  buyerCompanyId?: string;
  buyerUserId?: string;
  productName: string;
  categorySlug?: string;
  categoryId?: string;
  targetQuantity: number;
  targetPrice: number;
  barcodeOrSku?: string;
  deliveryDeadline?: string;
  notes?: string;
}

export interface WtbActionResult {
  success: boolean;
  wtbRequestId?: string;
  queueProcessed?: number;
  error?: string;
}

/**
 * Creates a Want-To-Buy (WTB) request on the board.
 * After database insertion (which fires the Postgres trigger to populate `wtb_notifications_queue`),
 * triggers immediate processing of the notification queue to dispatch alerts to vetted sellers.
 */
export async function createWtbRequest(data: WtbInput): Promise<WtbActionResult> {
  try {
    // 1. Validate inputs
    if (!data.buyerName?.trim()) {
      return { success: false, error: 'Buyer name is required.' };
    }
    if (!data.buyerEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.buyerEmail)) {
      return { success: false, error: 'Valid buyer email is required.' };
    }
    if (!data.productName?.trim()) {
      return { success: false, error: 'Requested product name is required.' };
    }
    if (!data.targetQuantity || data.targetQuantity <= 0) {
      return { success: false, error: 'Target quantity must be greater than zero.' };
    }
    if (data.targetPrice === undefined || data.targetPrice <= 0) {
      return { success: false, error: 'Target price must be greater than zero.' };
    }

    const admin = createAdminClient();

    // 2. Resolve category_id safely
    let resolvedCategoryId = data.categoryId;

    const { data: dbCategories } = await admin
      .from('categories')
      .select('id, slug, name');

    if (dbCategories && dbCategories.length > 0) {
      if (resolvedCategoryId) {
        const found = dbCategories.find((c) => c.id === resolvedCategoryId);
        if (!found) resolvedCategoryId = undefined;
      }

      if (!resolvedCategoryId && data.categorySlug) {
        const slugNorm = data.categorySlug.toLowerCase().trim();
        const found = dbCategories.find(
          (c) =>
            c.slug.toLowerCase() === slugNorm ||
            slugNorm.includes(c.slug.toLowerCase()) ||
            c.slug.toLowerCase().includes(slugNorm) ||
            c.name.toLowerCase().includes(slugNorm)
        );
        if (found) {
          resolvedCategoryId = found.id;
        }
      }

      // Fallback to first existing category
      if (!resolvedCategoryId) {
        resolvedCategoryId = dbCategories[0].id;
      }
    }

    if (!resolvedCategoryId) {
      return { success: false, error: 'No valid category found for WTB request.' };
    }

    // 3. Resolve valid UUID for buyer_user_id if present
    const rawUserId = data.buyerUserId || data.buyerCompanyId;
    const isUuid = rawUserId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawUserId) : false;
    const buyerUserId = isUuid ? rawUserId : null;

    const matchedCategory = dbCategories?.find((c) => c.id === resolvedCategoryId);
    const resolvedCategorySlug = matchedCategory?.slug || data.categorySlug || 'general';

    // 4. Insert into wtb_requests table
    const { data: insertedWtb, error: insertError } = await admin
      .from('wtb_requests')
      .insert({
        buyer_user_id: buyerUserId,
        buyer_name: data.buyerName.trim(),
        buyer_email: data.buyerEmail.trim().toLowerCase(),
        buyer_phone: data.buyerPhone?.trim() || null,
        buyer_company: data.buyerCompany?.trim() || null,
        category_id: resolvedCategoryId,
        product_name: data.productName.trim(),
        barcode_or_sku: data.barcodeOrSku?.trim() || null,
        target_quantity: data.targetQuantity,
        target_price: data.targetPrice,
        delivery_deadline: data.deliveryDeadline || null,
        notes: data.notes?.trim() || null,
        status: 'open',
      } as any)
      .select('id')
      .single();

    if (insertError || !insertedWtb) {
      console.error('[WTB INSERTION ERROR]', insertError?.message);
      return {
        success: false,
        error: insertError?.message || 'Failed to submit WTB request to database.',
      };
    }

    // 4. Trigger processing of the wtb_notifications_queue
    let processedCount = 0;
    try {
      const queueResult = await processWtbNotificationQueue();
      processedCount = queueResult.totalProcessed;
    } catch (qErr) {
      console.warn('[WTB QUEUE TRIGGER NOTICE]', qErr);
    }

    return {
      success: true,
      wtbRequestId: insertedWtb.id,
      queueProcessed: processedCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error submitting WTB request.';
    return { success: false, error: message };
  }
}

/**
 * Fetches all active Want-To-Buy requests from the database for the public board.
 */
export async function getPublicWtbRequests(): Promise<WtbRequest[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('wtb_requests')
      .select('*, category:categories(id, name, slug)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[GET PUBLIC WTB ERROR]', error?.message);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      buyer_company_id: row.buyer_user_id || null,
      buyer_company: row.buyer_company || null,
      buyer_name: row.buyer_name,
      buyer_email: row.buyer_email,
      buyer_phone: row.buyer_phone,
      product_name: row.product_name,
      category_id: row.category_id,
      category_slug: row.category?.slug || 'electronics',
      target_quantity: Number(row.target_quantity),
      target_price: Number(row.target_price),
      barcode_or_sku: row.barcode_or_sku,
      notes: row.notes,
      status: (row.status || 'open') as any,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.error('[GET PUBLIC WTB EXCEPTION]', err);
    return [];
  }
}

/**
 * Fetches WTB requests submitted by a specific buyer email.
 */
export async function getBuyerWtbRequests(buyerEmail: string): Promise<WtbRequest[]> {
  try {
    if (!buyerEmail) return [];
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('wtb_requests')
      .select('*, category:categories(id, name, slug)')
      .ilike('buyer_email', buyerEmail.trim().toLowerCase())
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[GET BUYER WTB ERROR]', error?.message);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      buyer_company_id: row.buyer_user_id || null,
      buyer_company: row.buyer_company || null,
      buyer_name: row.buyer_name,
      buyer_email: row.buyer_email,
      buyer_phone: row.buyer_phone,
      product_name: row.product_name,
      category_id: row.category_id,
      category_slug: row.category?.slug || 'electronics',
      target_quantity: Number(row.target_quantity),
      target_price: Number(row.target_price),
      barcode_or_sku: row.barcode_or_sku,
      notes: row.notes,
      status: (row.status || 'open') as any,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.error('[GET BUYER WTB EXCEPTION]', err);
    return [];
  }
}

/**
 * Standalone worker invocation for cron jobs or background schedules.
 */
export async function triggerQueueProcessing(): Promise<{
  success: boolean;
  totalProcessed: number;
  sentCount: number;
  failedCount: number;
}> {
  return processWtbNotificationQueue();
}

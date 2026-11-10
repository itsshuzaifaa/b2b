'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requireApprovedUser, requireAdmin, requireUser, AuthError } from '@/lib/auth/guards';
import { processWtbNotificationQueue } from '@/lib/email/dispatcher';
import { processMatchesForNewWtb } from '@/lib/matching/match-service';
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
  pricingType?: 'fixed' | 'neg' | 'poa';
  barcodeOrSku?: string;
  deliveryDeadline?: string;
  notes?: string;
}

export interface WtbActionResult {
  success: boolean;
  wtbRequestId?: string;
  queueProcessed?: number;
  error?: string;
  code?: string;
}

let cachedCategories: { data: { id: string; slug: string; name: string }[]; expiresAt: number } | null = null;

async function getCategoriesCached(admin: any): Promise<{ id: string; slug: string; name: string }[]> {
  const now = Date.now();
  if (cachedCategories && cachedCategories.expiresAt > now) {
    return cachedCategories.data;
  }
  const { data: dbCategories } = await admin
    .from('categories')
    .select('id, slug, name');
  if (dbCategories && dbCategories.length > 0) {
    cachedCategories = { data: dbCategories, expiresAt: now + 5 * 60 * 1000 };
    return dbCategories;
  }
  return cachedCategories?.data || [];
}

/**
 * Creates a Want-To-Buy (WTB) request on the board.
 * After database insertion (which fires the Postgres trigger to populate `wtb_notifications_queue`),
 * triggers immediate processing of the notification queue to dispatch alerts to vetted sellers.
 */
export async function createWtbRequest(data: WtbInput): Promise<WtbActionResult> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const status = auth.errorResponse?.status || 401;
    let code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED';
    let errorMsg = status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.';
    try {
      const cloned = auth.errorResponse?.clone();
      const errJson = await cloned?.json();
      if (errJson?.code) code = errJson.code;
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    return {
      success: false,
      error: errorMsg,
      code,
    };
  }

  try {
    // 1. Validate inputs
    if (!data.productName?.trim()) {
      return { success: false, error: 'Requested product name is required.' };
    }
    if (!data.targetQuantity || data.targetQuantity <= 0) {
      return { success: false, error: 'Target quantity must be greater than zero.' };
    }
    const isSpecialPricing = data.pricingType === 'neg' || data.pricingType === 'poa';
    if (!isSpecialPricing && (data.targetPrice === undefined || data.targetPrice <= 0)) {
      return { success: false, error: 'Target price must be greater than zero.' };
    }

    // Strictly enforce session identity for company and buyer contact
    const effectiveBuyerUserId = auth.user.id;
    const effectiveBuyerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();
    const effectiveBuyerCompany = auth.company?.company_name || auth.company?.name || 'Wholesale Member';
    const effectiveBuyerName = auth.company?.contact_name || data.buyerName?.trim() || 'Wholesale Buyer';
    const effectiveBuyerPhone = auth.company?.phone || data.buyerPhone?.trim() || null;

    if (!effectiveBuyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveBuyerEmail)) {
      return { success: false, error: 'Valid buyer email is required from active session.' };
    }

    const admin = createAdminClient();

    // 2. Resolve category_id safely
    let resolvedCategoryId = data.categoryId;

    const dbCategories = await getCategoriesCached(admin);

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

    let formattedNotes = data.notes?.trim() || '';
    if (data.pricingType === 'neg' && !formattedNotes.includes('Pricing: NEG')) {
      formattedNotes = formattedNotes ? `${formattedNotes} | Pricing: NEG` : 'Pricing: NEG';
    } else if (data.pricingType === 'poa' && !formattedNotes.includes('Pricing: POA')) {
      formattedNotes = formattedNotes ? `${formattedNotes} | Pricing: POA` : 'Pricing: POA';
    }

    // 4. Insert into wtb_requests table
    const { data: insertedWtb, error: insertError } = await admin
      .from('wtb_requests')
      .insert({
        buyer_user_id: effectiveBuyerUserId,
        buyer_name: effectiveBuyerName,
        buyer_email: effectiveBuyerEmail,
        buyer_phone: effectiveBuyerPhone,
        buyer_company: effectiveBuyerCompany,
        category_id: resolvedCategoryId,
        product_name: data.productName.trim(),
        barcode_or_sku: data.barcodeOrSku?.trim() || null,
        target_quantity: data.targetQuantity,
        target_price: (data.pricingType === 'neg' || data.pricingType === 'poa') ? 0 : data.targetPrice,
        delivery_deadline: data.deliveryDeadline || null,
        notes: formattedNotes || null,
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

    // 4. Trigger processing of the wtb_notifications_queue asynchronously (non-blocking for ultra-fast response)
    void processWtbNotificationQueue().catch((qErr) => {
      console.warn('[WTB QUEUE TRIGGER NOTICE]', qErr);
    });

    // 5. Trigger automatic matching with active WTS inventory & send immediate emails
    try {
      void processMatchesForNewWtb({
        id: insertedWtb.id,
        buyer_user_id: buyerUserId,
        buyer_company_id: data.buyerCompanyId || null,
        buyer_company: data.buyerCompany || null,
        buyer_name: data.buyerName.trim(),
        buyer_email: data.buyerEmail.trim().toLowerCase(),
        buyer_phone: data.buyerPhone?.trim() || null,
        product_name: data.productName.trim(),
        target_quantity: data.targetQuantity,
        target_price: data.targetPrice,
        barcode_or_sku: data.barcodeOrSku?.trim() || null,
        notes: data.notes?.trim() || null,
      });
    } catch (mErr) {
      console.warn('[WTB MATCH PROCESS NOTICE]', mErr);
    }

    cachedPublicWtbs = null;

    return {
      success: true,
      wtbRequestId: insertedWtb.id,
      queueProcessed: 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error submitting WTB request.';
    return { success: false, error: message };
  }
}

// In-memory cache for public WTBs to prevent server action latency spikes
let cachedPublicWtbs: { data: WtbRequest[]; timestamp: number } | null = null;
const WTB_CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Fetches all active Want-To-Buy requests from the database for the public board.
 * SECURITY MANDATE: Returns public columns ONLY.
 * Never leaks buyer email, buyer phone, or internal account identifiers.
 */
export async function getPublicWtbRequests(): Promise<WtbRequest[]> {
  if (cachedPublicWtbs && Date.now() - cachedPublicWtbs.timestamp < WTB_CACHE_TTL_MS) {
    return cachedPublicWtbs.data;
  }

  try {
    const admin = createAdminClient();

    // Enforce 3-second timeout guard to prevent landing page hangs
    const queryPromise = admin
      .from('wtb_requests')
      .select('id, product_name, category_id, target_quantity, target_price, barcode_or_sku, notes, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(60);

    const timeoutPromise = new Promise<{ data: any[]; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: cachedPublicWtbs?.data || [], error: null }), 3000)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error || !data) {
      console.warn('[GET PUBLIC WTB ERROR]', error?.message);
      return cachedPublicWtbs?.data || [];
    }

    const mapped: WtbRequest[] = data.map((row: any) => {
      const noteStr = row.notes || '';
      const detectedPricingType: 'fixed' | 'neg' | 'poa' =
        noteStr.includes('Pricing: NEG') || noteStr.includes('NEG') ? 'neg' :
        noteStr.includes('Pricing: POA') || noteStr.includes('POA') ? 'poa' : 'fixed';

      return {
        id: String(row.id),
        product_name: String(row.product_name || 'Procurement Lot'),
        buyer_name: 'Verified Buyer',
        buyer_email: '',
        buyer_phone: null,
        buyer_user_id: null,
        buyer_company_id: null,
        category_id: row.category_id || null,
        category_slug: 'consumer-electronics',
        target_quantity: Number(row.target_quantity) || 1,
        target_price: Number(row.target_price) || 0,
        pricing_type: detectedPricingType,
        barcode_or_sku: row.barcode_or_sku || null,
        notes: row.notes || null,
        status: (row.status || 'open') as any,
        created_at: row.created_at || new Date().toISOString(),
      };
    });

    cachedPublicWtbs = { data: mapped, timestamp: Date.now() };
    return mapped;
  } catch (err) {
    console.error('[GET PUBLIC WTB EXCEPTION]', err);
    return cachedPublicWtbs?.data || [];
  }
}

/**
 * Deletes / cancels a Want-To-Buy request.
 * SECURITY MANDATE:
 * Requires approved user session.
 * Caller MUST be the verified owner of the WTB request, or an administrator.
 */
export async function deleteWtbRequest(wtbId: string): Promise<{ success: boolean; error?: string; code?: string }> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const status = auth.errorResponse?.status || 401;
    let code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED';
    let errorMsg = status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.';
    try {
      const cloned = auth.errorResponse?.clone();
      const errJson = await cloned?.json();
      if (errJson?.code) code = errJson.code;
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    return {
      success: false,
      error: errorMsg,
      code,
    };
  }

  const admin = createAdminClient();
  const { data: wtb, error: fetchErr } = await admin
    .from('wtb_requests')
    .select('id, buyer_email, buyer_user_id')
    .eq('id', wtbId)
    .single();

  if (fetchErr || !wtb) {
    throw new AuthError(403, 'Forbidden: WTB request not found or not owned.');
  }

  const callerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();

  const isOwner =
    auth.isAdmin ||
    (wtb.buyer_user_id && wtb.buyer_user_id === auth.user.id) ||
    (wtb.buyer_email && wtb.buyer_email.toLowerCase().trim() === callerEmail);

  if (!isOwner) {
    throw new AuthError(403, 'Forbidden: You do not own this WTB request.');
  }

  const { error: deleteErr } = await admin
    .from('wtb_requests')
    .delete()
    .eq('id', wtbId);

  if (deleteErr) {
    return { success: false, error: deleteErr.message };
  }

  return { success: true };
}

/**
 * Fetches WTB requests submitted by the caller.
 * SECURITY MANDATE: Derives buyer email strictly from authenticated session.
 */
export async function getBuyerWtbRequests(buyerEmail?: string): Promise<WtbRequest[]> {
  try {
    const auth = await requireUser();
    if (auth.errorResponse || !auth.user) {
      return [];
    }

    const effectiveEmail = auth.isAdmin && buyerEmail ? buyerEmail.trim().toLowerCase() : auth.user.email?.toLowerCase();
    if (!effectiveEmail) return [];
    const admin = createAdminClient();

    const queryPromise = admin
      .from('wtb_requests')
      .select('*')
      .ilike('buyer_email', effectiveEmail)
      .order('created_at', { ascending: false })
      .limit(60);

    const timeoutPromise = new Promise<{ data: any[]; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: [], error: null }), 3000)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error || !data) {
      console.warn('[GET BUYER WTB ERROR]', error?.message);
      return [];
    }

    return data.map((row: any) => {
      const noteStr = row.notes || '';
      const detectedPricingType: 'fixed' | 'neg' | 'poa' =
        noteStr.includes('Pricing: NEG') || noteStr.includes('NEG') ? 'neg' :
        noteStr.includes('Pricing: POA') || noteStr.includes('POA') ? 'poa' : 'fixed';

      return {
        id: row.id,
        buyer_company_id: row.buyer_user_id || null,
        buyer_company: row.buyer_company || null,
        buyer_name: row.buyer_name,
        buyer_email: row.buyer_email,
        buyer_phone: row.buyer_phone,
        product_name: row.product_name,
        category_id: row.category_id,
        category_slug: 'consumer-electronics',
        target_quantity: Number(row.target_quantity),
        target_price: Number(row.target_price),
        pricing_type: detectedPricingType,
        barcode_or_sku: row.barcode_or_sku,
        notes: row.notes,
        status: (row.status || 'open') as any,
        created_at: row.created_at,
      };
    });
  } catch (err) {
    console.error('[GET BUYER WTB EXCEPTION]', err);
    return [];
  }
}

/**
 * Standalone worker invocation for maintenance cron jobs or platform administrators.
 * SECURITY MANDATE: Non-callable by unauthenticated or non-admin browser clients.
 * Enforces verified administrator privileges via requireAdmin().
 */
export async function triggerQueueProcessing(): Promise<{
  success: boolean;
  totalProcessed: number;
  sentCount: number;
  failedCount: number;
}> {
  const adminCheck = await requireAdmin();
  if (!adminCheck.isAdmin) {
    throw new AuthError(403, 'Forbidden: Administrator privileges required to process WTB queue.');
  }
  return processWtbNotificationQueue();
}

/**
 * Explicit alias to guarantee reprocessWtbQueueAction is non-callable from non-admin browser context.
 */
export const reprocessWtbQueueAction = triggerQueueProcessing;

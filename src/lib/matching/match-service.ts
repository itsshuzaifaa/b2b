import { createAdminClient } from '@/lib/supabase/server';
import {
  sendBuyerWtsMatchEmail,
  sendSellerWtbMatchEmail,
  sendConsolidatedMatchEmail,
} from '@/lib/email/dispatcher';
import type { MatchedStockItem } from '@/lib/email/templates';

export * from './match-types';
import {
  type TradeMatch,
  areItemsMatching,
} from './match-types';

/**
 * In-memory debounce queue to guarantee that even if multiple matches occur within
 * a short window (e.g., bulk CSV import or rapid API posts), each recipient receives
 * EXACTLY ONE consolidated email listing all matched stock items.
 */
interface PendingRecipientNotification {
  recipientType: 'buyer' | 'seller';
  recipientName: string;
  items: MatchedStockItem[];
  timer: NodeJS.Timeout;
}

const pendingMatchQueue = new Map<string, PendingRecipientNotification>();
const MATCH_DEBOUNCE_MS = 1000;

export function queueConsolidatedMatchEmail(
  toEmail: string,
  recipientType: 'buyer' | 'seller',
  recipientName: string,
  newItems: MatchedStockItem[]
): void {
  const emailKey = toEmail.toLowerCase().trim();
  if (!emailKey) return;

  const existing = pendingMatchQueue.get(emailKey);

  if (existing) {
    clearTimeout(existing.timer);
    for (const item of newItems) {
      const isDuplicate = existing.items.some(
        (it) => it.name === item.name && it.barcodeOrSku === item.barcodeOrSku
      );
      if (!isDuplicate) {
        existing.items.push(item);
      }
    }
    existing.timer = setTimeout(() => void flushRecipientMatchEmail(emailKey), MATCH_DEBOUNCE_MS);
  } else {
    const timer = setTimeout(() => void flushRecipientMatchEmail(emailKey), MATCH_DEBOUNCE_MS);
    pendingMatchQueue.set(emailKey, {
      recipientType,
      recipientName,
      items: [...newItems],
      timer,
    });
  }
}

export async function flushRecipientMatchEmail(emailKey: string): Promise<void> {
  const pending = pendingMatchQueue.get(emailKey);
  if (!pending) return;
  pendingMatchQueue.delete(emailKey);

  if (pending.items.length === 0) return;

  try {
    await sendConsolidatedMatchEmail(emailKey, {
      recipientType: pending.recipientType,
      recipientName: pending.recipientName,
      items: pending.items,
      actionUrl: '',
    });
  } catch (err) {
    console.error(`[MATCH EMAIL FLUSH ERROR for ${emailKey}]`, err);
  }
}

/**
 * Instantly flushes all queued match notifications across all recipients.
 * Useful for automated tests and synchronous batch completion.
 */
export async function flushAllPendingMatchEmails(): Promise<void> {
  const keys = Array.from(pendingMatchQueue.keys());
  await Promise.all(keys.map((k) => flushRecipientMatchEmail(k)));
}

/**
 * Triggered whenever a user posts a WTS (product listing).
 * Checks all existing open WTB requests that were previously waiting without available stock.
 * Dispatches a CONSOLIDATED email notification to matching buyers and records the matches.
 */
export async function processMatchesForNewProduct(newProduct: {
  id?: string;
  company_id: string;
  title: string;
  brand?: string | null;
  barcode_or_sku?: string | null;
  unit_price: number;
  quantity_available: number;
  condition?: string | null;
  description?: string | null;
  company?: { name?: string; contact_name?: string; email?: string; phone?: string | null };
}): Promise<TradeMatch[]> {
  const matches: TradeMatch[] = [];

  try {
    const admin = createAdminClient();

    // 1. Fetch seller company details if not provided
    let sellerName = newProduct.company?.name || 'Verified Supplier';
    let sellerEmail = newProduct.company?.email || '';
    let sellerPhone = newProduct.company?.phone || null;

    if (!sellerEmail && newProduct.company_id) {
      const { data: comp } = await admin
        .from('companies')
        .select('name, contact_name, email, phone')
        .eq('id', newProduct.company_id)
        .maybeSingle();

      if (comp) {
        sellerName = comp.name || comp.contact_name || sellerName;
        sellerEmail = comp.email || sellerEmail;
        sellerPhone = comp.phone || sellerPhone;
      }
    }

    // 2. Fetch all open WTB requests
    const { data: openWtbs, error: wtbErr } = await admin
      .from('wtb_requests')
      .select('*')
      .eq('status', 'open');

    if (wtbErr || !openWtbs || openWtbs.length === 0) {
      return [];
    }

    const buyerMatchesMap = new Map<string, { buyerName: string; items: MatchedStockItem[] }>();
    const sellerItems: MatchedStockItem[] = [];

    // 3. Compare each open WTB
    for (const wtb of openWtbs) {
      // Exclude self
      const isSelf =
        wtb.buyer_user_id === newProduct.company_id ||
        wtb.buyer_company_id === newProduct.company_id ||
        (sellerEmail && wtb.buyer_email?.toLowerCase() === sellerEmail.toLowerCase());

      if (isSelf) continue;

      const evalResult = areItemsMatching(
        {
          title: newProduct.title,
          brand: newProduct.brand,
          barcode_or_sku: newProduct.barcode_or_sku,
          unit_price: newProduct.unit_price,
        },
        {
          product_name: wtb.product_name,
          barcode_or_sku: wtb.barcode_or_sku,
          target_price: Number(wtb.target_price),
        }
      );

      if (evalResult.isMatch) {
        const matchId = `match-wts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const matchRecord: TradeMatch = {
          id: matchId,
          matchType: evalResult.matchType,
          triggerDirection: 'wts_created',
          confidence: evalResult.confidence,
          createdAt: new Date().toISOString(),

          wtbId: wtb.id,
          wtbProductName: wtb.product_name,
          wtbBarcode: wtb.barcode_or_sku,
          wtbTargetPrice: Number(wtb.target_price) || 0,
          wtbTargetQuantity: Number(wtb.target_quantity) || 1,
          buyerCompanyId: wtb.buyer_company_id || wtb.buyer_user_id,
          buyerCompanyName: wtb.buyer_company || wtb.buyer_name || 'Verified Buyer',
          buyerEmail: wtb.buyer_email,
          buyerPhone: wtb.buyer_phone,

          wtsProductId: newProduct.id || `prod-${Date.now()}`,
          wtsTitle: newProduct.title,
          wtsBarcode: newProduct.barcode_or_sku,
          wtsUnitPrice: Number(newProduct.unit_price) || 0,
          wtsQuantityAvailable: Number(newProduct.quantity_available) || 1,
          wtsCondition: newProduct.condition || 'New',
          wtsLocation: 'EU Central Depot',
          sellerCompanyId: newProduct.company_id,
          sellerCompanyName: sellerName,
          sellerEmail: sellerEmail,
          sellerPhone: sellerPhone,

          readByBuyer: false,
          readBySeller: false,
        };

        matches.push(matchRecord);

        // A. Accumulate for the buyer (grouped by buyer email)
        if (wtb.buyer_email) {
          const bEmail = wtb.buyer_email.toLowerCase().trim();
          const existing = buyerMatchesMap.get(bEmail) || {
            buyerName: wtb.buyer_name || wtb.buyer_company || 'Wholesale Buyer',
            items: [],
          };
          if (!existing.items.some((it) => it.name === newProduct.title && it.barcodeOrSku === (newProduct.barcode_or_sku || wtb.barcode_or_sku))) {
            existing.items.push({
              name: newProduct.title,
              barcodeOrSku: newProduct.barcode_or_sku || wtb.barcode_or_sku,
              quantity: Number(newProduct.quantity_available) || 1,
              unitPrice: Number(newProduct.unit_price) || 0,
              targetPrice: Number(wtb.target_price) || 0,
              condition: newProduct.condition || 'New',
              matchType: evalResult.matchType,
            });
          }
          buyerMatchesMap.set(bEmail, existing);
        }

        // B. Accumulate for the seller
        if (!sellerItems.some((it) => it.name === wtb.product_name && it.barcodeOrSku === (newProduct.barcode_or_sku || wtb.barcode_or_sku))) {
          sellerItems.push({
            name: wtb.product_name,
            barcodeOrSku: newProduct.barcode_or_sku || wtb.barcode_or_sku,
            quantity: Number(wtb.target_quantity) || 1,
            targetPrice: Number(wtb.target_price) || 0,
            unitPrice: Number(newProduct.unit_price) || 0,
            matchType: evalResult.matchType,
          });
        }

        // C. Record into product_inquiries with status 'smart_match' for database persistence
        try {
          await admin.from('product_inquiries').insert({
            product_id: newProduct.id || '00000000-0000-4000-a000-000000000001',
            seller_company_id: newProduct.company_id,
            buyer_company_id: wtb.buyer_user_id || wtb.buyer_company_id || null,
            buyer_company: wtb.buyer_company || wtb.buyer_name,
            buyer_name: wtb.buyer_name,
            buyer_email: wtb.buyer_email,
            buyer_phone: wtb.buyer_phone,
            target_quantity: Number(wtb.target_quantity) || 1,
            target_price: Number(wtb.target_price) || 0,
            offered_price: Number(newProduct.unit_price) || 0,
            message: JSON.stringify({
              type: 'trade_match',
              matchId,
              matchType: evalResult.matchType,
              confidence: evalResult.confidence,
              wtbId: wtb.id,
              wtbProductName: wtb.product_name,
              wtsTitle: newProduct.title,
              createdAt: matchRecord.createdAt,
            }),
            status: 'smart_match',
          } as any);
        } catch (dbErr) {
          console.warn('[RECORD MATCH IN DB NOTICE]', dbErr);
        }
      }
    }

    // 4. Dispatch EXACTLY ONE consolidated email per matching buyer
    for (const [buyerEmail, { buyerName, items }] of buyerMatchesMap) {
      queueConsolidatedMatchEmail(buyerEmail, 'buyer', buyerName, items);
    }

    // 5. Dispatch EXACTLY ONE consolidated email to the seller
    if (sellerEmail && sellerItems.length > 0) {
      queueConsolidatedMatchEmail(sellerEmail, 'seller', sellerName, sellerItems);
    }

    return matches;
  } catch (err) {
    console.error('[PROCESS MATCHES FOR NEW PRODUCT EXCEPTION]', err);
    return [];
  }
}

/**
 * Triggered whenever a user posts a WTB (Want-To-Buy) request.
 * Checks all existing active WTS product listings in the marketplace.
 * Dispatches a CONSOLIDATED email notification to matching parties and records the matches.
 */
export async function processMatchesForNewWtb(newWtb: {
  id?: string;
  buyer_user_id?: string | null;
  buyer_company_id?: string | null;
  buyer_company?: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  product_name: string;
  target_quantity: number;
  target_price: number;
  barcode_or_sku?: string | null;
  notes?: string | null;
}): Promise<TradeMatch[]> {
  const matches: TradeMatch[] = [];

  try {
    const admin = createAdminClient();

    // 1. Fetch active products with company info
    const { data: activeProducts, error: prodErr } = await admin
      .from('products')
      .select('*, company:companies(*)')
      .eq('status', 'active');

    if (prodErr || !activeProducts || activeProducts.length === 0) {
      return [];
    }

    const buyerEmail = newWtb.buyer_email.toLowerCase();
    const buyerId = newWtb.buyer_user_id || newWtb.buyer_company_id;

    const buyerItems: MatchedStockItem[] = [];
    const sellerMatchesMap = new Map<string, { sellerName: string; items: MatchedStockItem[] }>();

    for (const prod of activeProducts) {
      // Exclude self
      const sellerEmail = (prod.company?.email || prod.company?.contact_email || '').toLowerCase();
      const isSelf = (buyerId && prod.company_id === buyerId) || (sellerEmail && sellerEmail === buyerEmail);

      if (isSelf) continue;

      const evalResult = areItemsMatching(
        {
          title: prod.title,
          brand: prod.brand,
          barcode_or_sku: prod.barcode_or_sku,
          unit_price: Number(prod.unit_price),
        },
        {
          product_name: newWtb.product_name,
          barcode_or_sku: newWtb.barcode_or_sku,
          target_price: Number(newWtb.target_price),
        }
      );

      if (evalResult.isMatch) {
        const matchId = `match-wtb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const sellerName = prod.company?.company_name || prod.company?.name || 'Verified Supplier';

        const matchRecord: TradeMatch = {
          id: matchId,
          matchType: evalResult.matchType,
          triggerDirection: 'wtb_created',
          confidence: evalResult.confidence,
          createdAt: new Date().toISOString(),

          wtbId: newWtb.id || `wtb-${Date.now()}`,
          wtbProductName: newWtb.product_name,
          wtbBarcode: newWtb.barcode_or_sku,
          wtbTargetPrice: Number(newWtb.target_price) || 0,
          wtbTargetQuantity: Number(newWtb.target_quantity) || 1,
          buyerCompanyId: buyerId,
          buyerCompanyName: newWtb.buyer_company || newWtb.buyer_name,
          buyerEmail: newWtb.buyer_email,
          buyerPhone: newWtb.buyer_phone,

          wtsProductId: prod.id,
          wtsTitle: prod.title,
          wtsBarcode: prod.barcode_or_sku,
          wtsUnitPrice: Number(prod.unit_price) || 0,
          wtsQuantityAvailable: Number(prod.quantity_available) || 1,
          wtsCondition: prod.condition || 'New',
          wtsLocation: 'EU Central Depot',
          sellerCompanyId: prod.company_id,
          sellerCompanyName: sellerName,
          sellerEmail: prod.company?.email || null,
          sellerPhone: prod.company?.phone || null,

          readByBuyer: false,
          readBySeller: false,
        };

        matches.push(matchRecord);

        // A. Accumulate for the buyer (all matching products in one consolidated list)
        if (!buyerItems.some((it) => it.name === prod.title && it.barcodeOrSku === (prod.barcode_or_sku || newWtb.barcode_or_sku))) {
          buyerItems.push({
            name: prod.title,
            barcodeOrSku: prod.barcode_or_sku || newWtb.barcode_or_sku,
            quantity: Number(prod.quantity_available) || 1,
            unitPrice: Number(prod.unit_price) || 0,
            targetPrice: Number(newWtb.target_price) || 0,
            condition: prod.condition || 'New',
            matchType: evalResult.matchType,
          });
        }

        // B. Accumulate for the seller (grouped by seller email)
        const sEmail = (prod.company?.email || prod.company?.contact_email || '').toLowerCase().trim();
        if (sEmail) {
          const sName = prod.company?.company_name || prod.company?.name || 'Verified Supplier';
          const existing = sellerMatchesMap.get(sEmail) || {
            sellerName: prod.company?.contact_name || sName,
            items: [],
          };
          if (!existing.items.some((it) => it.name === newWtb.product_name && it.barcodeOrSku === (prod.barcode_or_sku || newWtb.barcode_or_sku))) {
            existing.items.push({
              name: newWtb.product_name,
              barcodeOrSku: prod.barcode_or_sku || newWtb.barcode_or_sku,
              quantity: Number(newWtb.target_quantity) || 1,
              targetPrice: Number(newWtb.target_price) || 0,
              unitPrice: Number(prod.unit_price) || 0,
              matchType: evalResult.matchType,
            });
          }
          sellerMatchesMap.set(sEmail, existing);
        }

        // C. Record into product_inquiries with status 'smart_match'
        try {
          await admin.from('product_inquiries').insert({
            product_id: prod.id,
            seller_company_id: prod.company_id,
            buyer_company_id: buyerId || null,
            buyer_company: newWtb.buyer_company || newWtb.buyer_name,
            buyer_name: newWtb.buyer_name,
            buyer_email: newWtb.buyer_email,
            buyer_phone: newWtb.buyer_phone,
            target_quantity: Number(newWtb.target_quantity) || 1,
            target_price: Number(newWtb.target_price) || 0,
            offered_price: Number(prod.unit_price) || 0,
            message: JSON.stringify({
              type: 'trade_match',
              matchId,
              matchType: evalResult.matchType,
              confidence: evalResult.confidence,
              wtbId: newWtb.id,
              wtbProductName: newWtb.product_name,
              wtsTitle: prod.title,
              createdAt: matchRecord.createdAt,
            }),
            status: 'smart_match',
          } as any);
        } catch (dbErr) {
          console.warn('[RECORD MATCH IN DB NOTICE]', dbErr);
        }
      }
    }

    // 2. Dispatch ONE consolidated email to buyer with all matching stock lots
    if (newWtb.buyer_email && buyerItems.length > 0) {
      queueConsolidatedMatchEmail(
        newWtb.buyer_email,
        'buyer',
        newWtb.buyer_name || newWtb.buyer_company || 'Wholesale Buyer',
        buyerItems
      );
    }

    // 3. Dispatch ONE consolidated email to each matching seller
    for (const [sellerEmail, { sellerName, items }] of sellerMatchesMap) {
      queueConsolidatedMatchEmail(sellerEmail, 'seller', sellerName, items);
    }

    return matches;
  } catch (err) {
    console.error('[PROCESS MATCHES FOR NEW WTB EXCEPTION]', err);
    return [];
  }
}

/**
 * Process matches for a batch of newly uploaded products (e.g. from CSV or Bulk Import).
 * Guarantees that even if 100 products are uploaded, each buyer and seller receives
 * AT MOST ONE consolidated email detailing all their matched items.
 */
export async function processBatchMatchesForProducts(
  products: Array<{
    id?: string;
    company_id: string;
    title: string;
    brand?: string | null;
    barcode_or_sku?: string | null;
    unit_price: number;
    quantity_available: number;
    condition?: string | null;
    description?: string | null;
    company?: { name?: string; contact_name?: string; email?: string; phone?: string | null };
  }>
): Promise<TradeMatch[]> {
  if (!products || products.length === 0) return [];

  const allMatches: TradeMatch[] = [];

  try {
    const admin = createAdminClient();

    // 1. Fetch all open WTB requests ONCE for the entire batch
    const { data: openWtbs, error: wtbErr } = await admin
      .from('wtb_requests')
      .select('*')
      .eq('status', 'open');

    if (wtbErr || !openWtbs || openWtbs.length === 0) {
      return [];
    }

    // 2. Resolve seller details map
    const companyIds = Array.from(new Set(products.map((p) => p.company_id).filter(Boolean)));
    const companyMap = new Map<string, { name: string; email: string; phone: string | null }>();

    if (companyIds.length > 0) {
      const { data: companies } = await admin
        .from('companies')
        .select('id, name, company_name, contact_name, email, phone')
        .in('id', companyIds);

      (companies || []).forEach((c) => {
        companyMap.set(c.id, {
          name: c.company_name || c.name || c.contact_name || 'Verified Supplier',
          email: c.email || '',
          phone: c.phone || null,
        });
      });
    }

    const buyerMatchesMap = new Map<string, { buyerName: string; items: MatchedStockItem[] }>();
    const sellerMatchesMap = new Map<string, { sellerName: string; items: MatchedStockItem[] }>();
    const inquiriesToInsert: any[] = [];

    // 3. Evaluate all product x WTB pairs
    for (const prod of products) {
      const comp = companyMap.get(prod.company_id) || prod.company;
      const sellerName = comp?.name || 'Verified Supplier';
      const sellerEmail = (comp?.email || '').toLowerCase().trim();

      for (const wtb of openWtbs) {
        const isSelf =
          wtb.buyer_user_id === prod.company_id ||
          wtb.buyer_company_id === prod.company_id ||
          (sellerEmail && wtb.buyer_email?.toLowerCase() === sellerEmail);

        if (isSelf) continue;

        const evalResult = areItemsMatching(
          {
            title: prod.title,
            brand: prod.brand,
            barcode_or_sku: prod.barcode_or_sku,
            unit_price: prod.unit_price,
          },
          {
            product_name: wtb.product_name,
            barcode_or_sku: wtb.barcode_or_sku,
            target_price: Number(wtb.target_price),
          }
        );

        if (evalResult.isMatch) {
          const matchId = `match-bulk-wts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const matchRecord: TradeMatch = {
            id: matchId,
            matchType: evalResult.matchType,
            triggerDirection: 'wts_created',
            confidence: evalResult.confidence,
            createdAt: new Date().toISOString(),

            wtbId: wtb.id,
            wtbProductName: wtb.product_name,
            wtbBarcode: wtb.barcode_or_sku,
            wtbTargetPrice: Number(wtb.target_price) || 0,
            wtbTargetQuantity: Number(wtb.target_quantity) || 1,
            buyerCompanyId: wtb.buyer_company_id || wtb.buyer_user_id,
            buyerCompanyName: wtb.buyer_company || wtb.buyer_name || 'Verified Buyer',
            buyerEmail: wtb.buyer_email,
            buyerPhone: wtb.buyer_phone,

            wtsProductId: prod.id || `prod-${Date.now()}`,
            wtsTitle: prod.title,
            wtsBarcode: prod.barcode_or_sku,
            wtsUnitPrice: Number(prod.unit_price) || 0,
            wtsQuantityAvailable: Number(prod.quantity_available) || 1,
            wtsCondition: prod.condition || 'New',
            wtsLocation: 'EU Central Depot',
            sellerCompanyId: prod.company_id,
            sellerCompanyName: sellerName,
            sellerEmail,
            sellerPhone: comp?.phone || null,

            readByBuyer: false,
            readBySeller: false,
          };

          allMatches.push(matchRecord);

          // Group by buyer email
          if (wtb.buyer_email) {
            const bEmail = wtb.buyer_email.toLowerCase().trim();
            const existing = buyerMatchesMap.get(bEmail) || {
              buyerName: wtb.buyer_name || wtb.buyer_company || 'Wholesale Buyer',
              items: [],
            };
            if (!existing.items.some((it) => it.name === prod.title && it.barcodeOrSku === (prod.barcode_or_sku || wtb.barcode_or_sku))) {
              existing.items.push({
                name: prod.title,
                barcodeOrSku: prod.barcode_or_sku || wtb.barcode_or_sku,
                quantity: Number(prod.quantity_available) || 1,
                unitPrice: Number(prod.unit_price) || 0,
                targetPrice: Number(wtb.target_price) || 0,
                condition: prod.condition || 'New',
                matchType: evalResult.matchType,
              });
            }
            buyerMatchesMap.set(bEmail, existing);
          }

          // Group by seller email
          if (sellerEmail) {
            const existing = sellerMatchesMap.get(sellerEmail) || {
              sellerName,
              items: [],
            };
            if (!existing.items.some((it) => it.name === wtb.product_name && it.barcodeOrSku === (prod.barcode_or_sku || wtb.barcode_or_sku))) {
              existing.items.push({
                name: wtb.product_name,
                barcodeOrSku: prod.barcode_or_sku || wtb.barcode_or_sku,
                quantity: Number(wtb.target_quantity) || 1,
                targetPrice: Number(wtb.target_price) || 0,
                unitPrice: Number(prod.unit_price) || 0,
                matchType: evalResult.matchType,
              });
            }
            sellerMatchesMap.set(sellerEmail, existing);
          }

          inquiriesToInsert.push({
            product_id: prod.id || '00000000-0000-4000-a000-000000000001',
            seller_company_id: prod.company_id,
            buyer_company_id: wtb.buyer_user_id || wtb.buyer_company_id || null,
            buyer_company: wtb.buyer_company || wtb.buyer_name,
            buyer_name: wtb.buyer_name,
            buyer_email: wtb.buyer_email,
            buyer_phone: wtb.buyer_phone,
            target_quantity: Number(wtb.target_quantity) || 1,
            target_price: Number(wtb.target_price) || 0,
            offered_price: Number(prod.unit_price) || 0,
            message: JSON.stringify({
              type: 'trade_match',
              matchId,
              matchType: evalResult.matchType,
              confidence: evalResult.confidence,
              wtbId: wtb.id,
              wtbProductName: wtb.product_name,
              wtsTitle: prod.title,
              createdAt: matchRecord.createdAt,
            }),
            status: 'smart_match',
          });
        }
      }
    }

    // 4. Batch insert inquiries into database
    if (inquiriesToInsert.length > 0) {
      try {
        await admin.from('product_inquiries').insert(inquiriesToInsert);
      } catch (dbErr) {
        console.warn('[BATCH INSERT MATCH INQUIRIES NOTICE]', dbErr);
      }
    }

    // 5. Dispatch exactly ONE email to each matching buyer
    for (const [buyerEmail, { buyerName, items }] of buyerMatchesMap) {
      queueConsolidatedMatchEmail(buyerEmail, 'buyer', buyerName, items);
    }

    // 6. Dispatch exactly ONE email to each matching seller
    for (const [sellerEmail, { sellerName, items }] of sellerMatchesMap) {
      queueConsolidatedMatchEmail(sellerEmail, 'seller', sellerName, items);
    }

    return allMatches;
  } catch (err) {
    console.error('[PROCESS BATCH MATCHES FOR PRODUCTS EXCEPTION]', err);
    return [];
  }
}

/**
 * Process matches for a batch of newly uploaded WTB requests.
 * Guarantees that each seller and buyer receives AT MOST ONE consolidated email.
 */
export async function processBatchMatchesForWtbs(
  wtbRequests: Array<{
    id?: string;
    buyer_user_id?: string | null;
    buyer_company_id?: string | null;
    buyer_company?: string | null;
    buyer_name: string;
    buyer_email: string;
    buyer_phone?: string | null;
    product_name: string;
    target_quantity: number;
    target_price: number;
    barcode_or_sku?: string | null;
    notes?: string | null;
  }>
): Promise<TradeMatch[]> {
  if (!wtbRequests || wtbRequests.length === 0) return [];

  const allMatches: TradeMatch[] = [];

  try {
    const admin = createAdminClient();

    // 1. Fetch all active products ONCE
    const { data: activeProducts, error: prodErr } = await admin
      .from('products')
      .select('*, company:companies(*)')
      .eq('status', 'active');

    if (prodErr || !activeProducts || activeProducts.length === 0) {
      return [];
    }

    const buyerMatchesMap = new Map<string, { buyerName: string; items: MatchedStockItem[] }>();
    const sellerMatchesMap = new Map<string, { sellerName: string; items: MatchedStockItem[] }>();
    const inquiriesToInsert: any[] = [];

    for (const wtb of wtbRequests) {
      const buyerEmail = wtb.buyer_email.toLowerCase().trim();
      const buyerId = wtb.buyer_user_id || wtb.buyer_company_id;

      for (const prod of activeProducts) {
        const sellerEmail = (prod.company?.email || prod.company?.contact_email || '').toLowerCase().trim();
        const isSelf = (buyerId && prod.company_id === buyerId) || (sellerEmail && sellerEmail === buyerEmail);

        if (isSelf) continue;

        const evalResult = areItemsMatching(
          {
            title: prod.title,
            brand: prod.brand,
            barcode_or_sku: prod.barcode_or_sku,
            unit_price: Number(prod.unit_price),
          },
          {
            product_name: wtb.product_name,
            barcode_or_sku: wtb.barcode_or_sku,
            target_price: Number(wtb.target_price),
          }
        );

        if (evalResult.isMatch) {
          const matchId = `match-bulk-wtb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const sellerName = prod.company?.company_name || prod.company?.name || 'Verified Supplier';

          const matchRecord: TradeMatch = {
            id: matchId,
            matchType: evalResult.matchType,
            triggerDirection: 'wtb_created',
            confidence: evalResult.confidence,
            createdAt: new Date().toISOString(),

            wtbId: wtb.id || `wtb-${Date.now()}`,
            wtbProductName: wtb.product_name,
            wtbBarcode: wtb.barcode_or_sku,
            wtbTargetPrice: Number(wtb.target_price) || 0,
            wtbTargetQuantity: Number(wtb.target_quantity) || 1,
            buyerCompanyId: buyerId,
            buyerCompanyName: wtb.buyer_company || wtb.buyer_name,
            buyerEmail: wtb.buyer_email,
            buyerPhone: wtb.buyer_phone,

            wtsProductId: prod.id,
            wtsTitle: prod.title,
            wtsBarcode: prod.barcode_or_sku,
            wtsUnitPrice: Number(prod.unit_price) || 0,
            wtsQuantityAvailable: Number(prod.quantity_available) || 1,
            wtsCondition: prod.condition || 'New',
            wtsLocation: 'EU Central Depot',
            sellerCompanyId: prod.company_id,
            sellerCompanyName: sellerName,
            sellerEmail: prod.company?.email || null,
            sellerPhone: prod.company?.phone || null,

            readByBuyer: false,
            readBySeller: false,
          };

          allMatches.push(matchRecord);

          // Group by buyer
          if (wtb.buyer_email) {
            const existing = buyerMatchesMap.get(buyerEmail) || {
              buyerName: wtb.buyer_name || wtb.buyer_company || 'Wholesale Buyer',
              items: [],
            };
            if (!existing.items.some((it) => it.name === prod.title && it.barcodeOrSku === (prod.barcode_or_sku || wtb.barcode_or_sku))) {
              existing.items.push({
                name: prod.title,
                barcodeOrSku: prod.barcode_or_sku || wtb.barcode_or_sku,
                quantity: Number(prod.quantity_available) || 1,
                unitPrice: Number(prod.unit_price) || 0,
                targetPrice: Number(wtb.target_price) || 0,
                condition: prod.condition || 'New',
                matchType: evalResult.matchType,
              });
            }
            buyerMatchesMap.set(buyerEmail, existing);
          }

          // Group by seller
          if (sellerEmail) {
            const existing = sellerMatchesMap.get(sellerEmail) || {
              sellerName: prod.company?.contact_name || sellerName,
              items: [],
            };
            if (!existing.items.some((it) => it.name === wtb.product_name && it.barcodeOrSku === (prod.barcode_or_sku || wtb.barcode_or_sku))) {
              existing.items.push({
                name: wtb.product_name,
                barcodeOrSku: prod.barcode_or_sku || wtb.barcode_or_sku,
                quantity: Number(wtb.target_quantity) || 1,
                targetPrice: Number(wtb.target_price) || 0,
                unitPrice: Number(prod.unit_price) || 0,
                matchType: evalResult.matchType,
              });
            }
            sellerMatchesMap.set(sellerEmail, existing);
          }

          inquiriesToInsert.push({
            product_id: prod.id,
            seller_company_id: prod.company_id,
            buyer_company_id: buyerId || null,
            buyer_company: wtb.buyer_company || wtb.buyer_name,
            buyer_name: wtb.buyer_name,
            buyer_email: wtb.buyer_email,
            buyer_phone: wtb.buyer_phone,
            target_quantity: Number(wtb.target_quantity) || 1,
            target_price: Number(wtb.target_price) || 0,
            offered_price: Number(prod.unit_price) || 0,
            message: JSON.stringify({
              type: 'trade_match',
              matchId,
              matchType: evalResult.matchType,
              confidence: evalResult.confidence,
              wtbId: wtb.id,
              wtbProductName: wtb.product_name,
              wtsTitle: prod.title,
              createdAt: matchRecord.createdAt,
            }),
            status: 'smart_match',
          });
        }
      }
    }

    if (inquiriesToInsert.length > 0) {
      try {
        await admin.from('product_inquiries').insert(inquiriesToInsert);
      } catch (dbErr) {
        console.warn('[BATCH INSERT WTB MATCH INQUIRIES NOTICE]', dbErr);
      }
    }

    for (const [bEmail, { buyerName, items }] of buyerMatchesMap) {
      queueConsolidatedMatchEmail(bEmail, 'buyer', buyerName, items);
    }

    for (const [sEmail, { sellerName, items }] of sellerMatchesMap) {
      queueConsolidatedMatchEmail(sEmail, 'seller', sellerName, items);
    }

    return allMatches;
  } catch (err) {
    console.error('[PROCESS BATCH MATCHES FOR WTBS EXCEPTION]', err);
    return [];
  }
}

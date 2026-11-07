import { createAdminClient } from '@/lib/supabase/server';
import { sendBuyerWtsMatchEmail, sendSellerWtbMatchEmail } from '@/lib/email/dispatcher';
import type { Product, WtbRequest, Company } from '@/types/database';

export * from './match-types';
import {
  type TradeMatch,
  areItemsMatching,
} from './match-types';

/**
 * Triggered whenever a user posts a WTS (product listing).
 * Checks all existing open WTB requests that were previously waiting without available stock.
 * Dispatches immediate email notifications to matching buyers and records the match.
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

        // A. IMMEDIATELY SEND EMAIL TO THE BUYER WHO WAS WAITING FOR THIS STOCK
        if (wtb.buyer_email) {
          try {
            await sendBuyerWtsMatchEmail(wtb.buyer_email, {
              buyerName: wtb.buyer_name || wtb.buyer_company || 'Buyer',
              wtbProductName: wtb.product_name,
              sellerCompanyName: sellerName,
              listingTitle: newProduct.title,
              barcodeOrSku: newProduct.barcode_or_sku || wtb.barcode_or_sku,
              unitPrice: Number(newProduct.unit_price) || 0,
              targetPrice: Number(wtb.target_price) || 0,
              quantityAvailable: Number(newProduct.quantity_available) || 0,
              targetQuantity: Number(wtb.target_quantity) || 0,
              condition: newProduct.condition || 'New',
              location: 'EU Warehouse',
              matchId,
              wtbId: wtb.id,
              productId: newProduct.id,
            });
          } catch (mailErr) {
            console.error('[MATCH EMAIL ERROR TO BUYER]', mailErr);
          }
        }

        // B. ALSO SEND EMAIL TO SELLER ALERTING THEM OF THE MATCHING BUYER DEMAND
        if (sellerEmail) {
          try {
            await sendSellerWtbMatchEmail(sellerEmail, {
              sellerName,
              listingTitle: newProduct.title,
              buyerCompanyName: wtb.buyer_company || wtb.buyer_name || 'Verified Buyer',
              wtbProductName: wtb.product_name,
              barcodeOrSku: newProduct.barcode_or_sku || wtb.barcode_or_sku,
              targetQuantity: Number(wtb.target_quantity) || 1,
              targetPrice: Number(wtb.target_price) || 0,
              listingPrice: Number(newProduct.unit_price) || 0,
              notes: wtb.notes || null,
              matchId,
              wtbId: wtb.id,
              productId: newProduct.id,
            });
          } catch (mailErr) {
            console.error('[MATCH EMAIL ERROR TO SELLER]', mailErr);
          }
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

    return matches;
  } catch (err) {
    console.error('[PROCESS MATCHES FOR NEW PRODUCT EXCEPTION]', err);
    return [];
  }
}

/**
 * Triggered whenever a user posts a WTB (Want-To-Buy) request.
 * Checks all existing active WTS product listings in the marketplace.
 * Dispatches immediate email notifications to matching sellers and records the match.
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

        // A. IMMEDIATELY SEND EMAIL TO THE SELLER ABOUT THIS BUYER DEMAND
        if (prod.company?.email) {
          try {
            await sendSellerWtbMatchEmail(prod.company.email, {
              sellerName: prod.company.contact_name || sellerName,
              listingTitle: prod.title,
              buyerCompanyName: newWtb.buyer_company || newWtb.buyer_name,
              wtbProductName: newWtb.product_name,
              barcodeOrSku: prod.barcode_or_sku || newWtb.barcode_or_sku,
              targetQuantity: Number(newWtb.target_quantity) || 1,
              targetPrice: Number(newWtb.target_price) || 0,
              listingPrice: Number(prod.unit_price) || 0,
              notes: newWtb.notes || null,
              matchId,
              wtbId: newWtb.id,
              productId: prod.id,
            });
          } catch (mailErr) {
            console.error('[MATCH EMAIL ERROR TO SELLER]', mailErr);
          }
        }

        // B. ALSO SEND EMAIL TO BUYER ALERTING THEM THAT MATCHING STOCK IS ALREADY LISTED
        if (newWtb.buyer_email) {
          try {
            await sendBuyerWtsMatchEmail(newWtb.buyer_email, {
              buyerName: newWtb.buyer_name || newWtb.buyer_company || 'Buyer',
              wtbProductName: newWtb.product_name,
              sellerCompanyName: sellerName,
              listingTitle: prod.title,
              barcodeOrSku: prod.barcode_or_sku || newWtb.barcode_or_sku,
              unitPrice: Number(prod.unit_price) || 0,
              targetPrice: Number(newWtb.target_price) || 0,
              quantityAvailable: Number(prod.quantity_available) || 0,
              targetQuantity: Number(newWtb.target_quantity) || 0,
              condition: prod.condition || 'New',
              location: 'EU Warehouse',
              matchId,
              wtbId: newWtb.id,
              productId: prod.id,
            });
          } catch (mailErr) {
            console.error('[MATCH EMAIL ERROR TO BUYER]', mailErr);
          }
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

    return matches;
  } catch (err) {
    console.error('[PROCESS MATCHES FOR NEW WTB EXCEPTION]', err);
    return [];
  }
}

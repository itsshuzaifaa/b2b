import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { requireApprovedUser } from '@/lib/auth/guards';
import {
  areItemsMatching,
  normalizeBarcode,
  type TradeMatch,
  processMatchesForNewProduct,
  processMatchesForNewWtb,
} from '@/lib/matching/match-service';

/**
 * GET /api/matches
 * Retrieves trade matches between active WTS products and open WTB requests.
 * 
 * SECURITY MANDATE:
 * 1. Requires authenticated and approved user session via requireApprovedUser().
 * 2. Never accepts company ID or email from query parameters for non-admins.
 * 3. Results are strictly filtered to only matches involving the caller's company.
 * 4. Admins can view all matches platform-wide.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const admin = createAdminClient();

    // Enforce session identity strictly
    const callerCompanyId = auth.company?.id;
    const callerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();

    // Optional query params
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get('type'); // 'exact_barcode' | 'title_keyword' | null
    const filterPair = searchParams.get('pair'); // pairKey filter

    // 1. Fetch active products & open WTBs in parallel (paginated past Supabase's 1,000-row cap)
    const [products, wtbs] = await Promise.all([
      fetchAllRows<any>((from, to) =>
        admin.from('products').select('*, company:companies(*)').eq('status', 'active').range(from, to)
      ).catch(() => []),
      fetchAllRows<any>((from, to) =>
        admin.from('wtb_requests').select('*').eq('status', 'open').range(from, to)
      ).catch(() => []),
    ]);

    if (!products.length || !wtbs.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        totalCount: 0,
        distinctPairs: [],
        distinctPairCount: 0,
        exactBarcodeCount: 0,
        specMatchCount: 0,
      });
    }

    const matches: TradeMatch[] = [];
    const pairMap = new Map<string, {
      pairKey: string;
      buyerCompanyName: string;
      buyerEmail: string;
      sellerCompanyName: string;
      sellerEmail: string;
      sellerCompanyId: string;
      buyerCompanyId?: string | null;
      totalMatches: number;
      exactBarcodeMatches: number;
      specMatches: number;
    }>();

    let exactBarcodeCount = 0;
    let specMatchCount = 0;

    // Helper to check if a product/wtb belongs to the current caller
    const isProdCaller = (prod: any) => {
      const prodSellerEmail = (prod.company?.email || prod.company?.contact_email || '').toLowerCase();
      return Boolean(
        (callerCompanyId && prod.company_id === callerCompanyId) ||
        (callerEmail && prodSellerEmail === callerEmail)
      );
    };

    const isWtbCaller = (wtb: any) => {
      const wtbBuyerEmail = (wtb.buyer_email || '').toLowerCase();
      return Boolean(
        (callerCompanyId && (wtb.buyer_user_id === callerCompanyId || wtb.buyer_company_id === callerCompanyId)) ||
        (callerEmail && wtbBuyerEmail === callerEmail)
      );
    };

    const evalPair = (prod: any, wtb: any) => {
      const prodSellerEmail = (prod.company?.email || prod.company?.contact_email || '').toLowerCase();
      const sellerName = prod.company?.company_name || prod.company?.name || 'Verified Supplier';
      const wtbBuyerEmail = (wtb.buyer_email || '').toLowerCase();
      const buyerName = wtb.buyer_company || wtb.buyer_name || 'Verified Buyer';

      const isSelf =
        (wtb.buyer_user_id && prod.company_id === wtb.buyer_user_id) ||
        (wtb.buyer_company_id && prod.company_id === wtb.buyer_company_id) ||
        (prodSellerEmail && wtbBuyerEmail && prodSellerEmail === wtbBuyerEmail);

      if (isSelf) return;

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
        if (evalResult.matchType === 'exact_barcode') {
          exactBarcodeCount++;
        } else {
          specMatchCount++;
        }

        const pairKey = `${buyerName} <-> ${sellerName}`;
        const existingPair = pairMap.get(pairKey) || {
          pairKey,
          buyerCompanyName: buyerName,
          buyerEmail: wtb.buyer_email,
          sellerCompanyName: sellerName,
          sellerEmail: prod.company?.email || prodSellerEmail,
          sellerCompanyId: prod.company_id,
          buyerCompanyId: wtb.buyer_company_id || wtb.buyer_user_id,
          totalMatches: 0,
          exactBarcodeMatches: 0,
          specMatches: 0,
        };
        existingPair.totalMatches++;
        if (evalResult.matchType === 'exact_barcode') {
          existingPair.exactBarcodeMatches++;
        } else {
          existingPair.specMatches++;
        }
        pairMap.set(pairKey, existingPair);

        if (filterType && filterType !== 'all' && evalResult.matchType !== filterType) {
          return;
        }
        if (filterPair && pairKey !== filterPair) {
          return;
        }

        matches.push({
          id: `match-${prod.id.slice(0, 8)}-${wtb.id.slice(0, 8)}`,
          matchType: evalResult.matchType,
          triggerDirection: 'wts_created',
          confidence: evalResult.confidence,
          createdAt: prod.created_at || wtb.created_at || new Date().toISOString(),

          wtbId: wtb.id,
          wtbProductName: wtb.product_name,
          wtbBarcode: wtb.barcode_or_sku,
          wtbTargetPrice: Number(wtb.target_price) || 0,
          wtbTargetQuantity: Number(wtb.target_quantity) || 1,
          buyerCompanyId: wtb.buyer_company_id || wtb.buyer_user_id,
          buyerCompanyName: buyerName,
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
          sellerEmail: prod.company?.email || prod.company?.contact_email || null,
          sellerPhone: prod.company?.phone || null,

          readByBuyer: false,
          readBySeller: false,
        });
      }
    };

    if (auth.isAdmin) {
      for (const prod of products) {
        for (const wtb of wtbs) {
          evalPair(prod, wtb);
        }
      }
    } else {
      // Pre-filter caller-relevant sets to avoid evaluating unrelated counterparties
      const callerProds = products.filter(isProdCaller);
      const otherProds = products.filter((p) => !isProdCaller(p));
      const callerWtbs = wtbs.filter(isWtbCaller);
      const otherWtbs = wtbs.filter((w) => !isWtbCaller(w));

      for (const prod of callerProds) {
        for (const wtb of otherWtbs) {
          evalPair(prod, wtb);
        }
      }
      for (const prod of otherProds) {
        for (const wtb of callerWtbs) {
          evalPair(prod, wtb);
        }
      }
    }

    const distinctPairs = Array.from(pairMap.values());

    return NextResponse.json({
      success: true,
      matches,
      totalCount: matches.length,
      distinctPairs,
      distinctPairCount: distinctPairs.length,
      exactBarcodeCount,
      specMatchCount,
    });
  } catch (err) {
    console.error('[GET MATCHES ERROR]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/matches
 * Processes on-demand match evaluation for new products or WTB requests.
 * 
 * SECURITY MANDATE:
 * 1. Requires authenticated and approved user session via requireApprovedUser().
 * 2. Non-admins cannot process matches for other companies.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { action, product, wtb } = body;

    const callerCompanyId = auth.company?.id;

    if (action === 'process_product' && product) {
      // Non-admins can only match their own company's products
      const effectiveProduct = {
        ...product,
        company_id: auth.isAdmin ? (product.company_id || callerCompanyId) : callerCompanyId,
      };

      const matches = await processMatchesForNewProduct(effectiveProduct);
      return NextResponse.json({ success: true, matches });
    }

    if (action === 'process_wtb' && wtb) {
      // Non-admins can only match their own company's WTB requests
      const effectiveWtb = {
        ...wtb,
        buyer_user_id: auth.isAdmin ? (wtb.buyer_user_id || auth.user.id) : auth.user.id,
        buyer_company_id: auth.isAdmin ? (wtb.buyer_company_id || callerCompanyId) : callerCompanyId,
        buyer_email: auth.isAdmin ? (wtb.buyer_email || auth.user.email) : (auth.company?.contact_email || auth.user.email),
      };

      const matches = await processMatchesForNewWtb(effectiveWtb);
      return NextResponse.json({ success: true, matches });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST MATCHES ERROR]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to process match action' },
      { status: 500 }
    );
  }
}

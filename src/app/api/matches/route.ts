import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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

    // 1. Fetch active products
    const { data: products } = await admin
      .from('products')
      .select('*, company:companies(*)')
      .eq('status', 'active');

    // 2. Fetch open WTB requests
    const { data: wtbs } = await admin
      .from('wtb_requests')
      .select('*')
      .eq('status', 'open');

    const matches: TradeMatch[] = [];

    if (products && wtbs) {
      for (const prod of products) {
        const prodSellerEmail = (prod.company?.email || prod.company?.contact_email || '').toLowerCase();
        const sellerName = prod.company?.company_name || prod.company?.name || 'Verified Supplier';

        for (const wtb of wtbs) {
          const wtbBuyerEmail = (wtb.buyer_email || '').toLowerCase();

          // Exclude self matches
          const isSelf =
            (wtb.buyer_user_id && prod.company_id === wtb.buyer_user_id) ||
            (wtb.buyer_company_id && prod.company_id === wtb.buyer_company_id) ||
            (prodSellerEmail && wtbBuyerEmail && prodSellerEmail === wtbBuyerEmail);

          if (isSelf) continue;

          // Strictly filter relevance to caller's verified company
          const isRelevantToUser = auth.isAdmin
            ? true
            : Boolean(
                (callerCompanyId && (
                  prod.company_id === callerCompanyId ||
                  wtb.buyer_company_id === callerCompanyId ||
                  wtb.buyer_user_id === callerCompanyId
                )) ||
                (callerEmail && (
                  prodSellerEmail === callerEmail ||
                  wtbBuyerEmail === callerEmail
                ))
              );

          if (!isRelevantToUser) continue;

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
              buyerCompanyName: wtb.buyer_company || wtb.buyer_name || 'Verified Buyer',
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
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      matches,
      totalCount: matches.length,
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

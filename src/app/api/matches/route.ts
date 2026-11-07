import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  areItemsMatching,
  normalizeBarcode,
  type TradeMatch,
  processMatchesForNewProduct,
  processMatchesForNewWtb,
} from '@/lib/matching/match-service';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const userEmail = searchParams.get('email')?.toLowerCase().trim();

    const admin = createAdminClient();

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

          // Check if this match is relevant to the requesting user
          const isRelevantToUser =
            !companyId && !userEmail
              ? true
              : (companyId && (prod.company_id === companyId || wtb.buyer_user_id === companyId || wtb.buyer_company_id === companyId)) ||
                (userEmail && (prodSellerEmail === userEmail || wtbBuyerEmail === userEmail));

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, product, wtb } = body;

    if (action === 'process_product' && product) {
      const matches = await processMatchesForNewProduct(product);
      return NextResponse.json({ success: true, matches });
    }

    if (action === 'process_wtb' && wtb) {
      const matches = await processMatchesForNewWtb(wtb);
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

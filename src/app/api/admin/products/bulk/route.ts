import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { processMatchesForNewProduct, processMatchesForNewWtb } from '@/lib/matching/match-service';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { companyId, email, companyName, tier, products } = body;

    if (!companyId && !email && !companyName) {
      return NextResponse.json({ success: false, error: 'Seller company identifier or email is required.' }, { status: 400 });
    }
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, error: 'No products provided for import.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Resolve target company in Supabase by ID only (no ilike)
    let comp: any = null;

    if (companyId) {
      const { data: byId } = await admin
        .from('companies')
        .select('id, user_id, approval_status, company_name, tier, contact_email')
        .eq('id', companyId)
        .maybeSingle();
      comp = byId;

      if (!comp) {
        const { data: byUserId } = await admin
          .from('companies')
          .select('id, user_id, approval_status, company_name, tier, contact_email')
          .eq('user_id', companyId)
          .maybeSingle();
        comp = byUserId;
      }
    }

    // 2. If company still doesn't exist, auto-create it with Gold tier (or specified tier)
    if (!comp) {
      const targetTier = (tier || 'gold').toLowerCase();

      // Resolve user_id: check if companyId is an auth user ID or look up auth user by email
      let resolvedUserId: string | null = null;
      if (companyId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(companyId);
          if (authUser?.user?.id) {
            resolvedUserId = authUser.user.id;
          }
        } catch {}
      }

      if (!resolvedUserId && email) {
        try {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: email.trim().toLowerCase(),
          });
          if (linkData?.user?.id) {
            resolvedUserId = linkData.user.id;
          }
        } catch {}
      }

      const { data: createdComp, error: createError } = await admin
        .from('companies')
        .insert({
          user_id: resolvedUserId,
          company_name: companyName || 'Wholesale Supplier',
          contact_email: email || null,
          role: 'seller',
          approval_status: 'approved',
          tier: targetTier,
          updated_at: new Date().toISOString(),
        })
        .select('id, user_id, approval_status, company_name, tier, contact_email')
        .maybeSingle();

      if (createError) {
        console.error('[AUTO CREATE COMPANY ERROR]', createError);
      }
      comp = createdComp;
    }

    if (!comp?.id) {
      return NextResponse.json(
        { success: false, error: 'Could not resolve or create target seller company.' },
        { status: 404 }
      );
    }

    const effectiveCompanyId = comp.id;

    // 3. Ensure company is approved & sync tier to Gold if account is Gold
    const targetTier = (tier || comp.tier || 'gold').toLowerCase();
    const updates: Record<string, any> = {};

    if (comp.approval_status !== 'approved') {
      updates.approval_status = 'approved';
    }
    // If the account being uploaded to is Gold, or if uploading > 50 products, ensure company row reflects Gold to satisfy tier quota trigger
    if ((targetTier === 'gold' || products.length > 50) && comp.tier !== 'gold') {
      updates.tier = 'gold';
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await admin.from('companies').update(updates).eq('id', effectiveCompanyId);
    }

    // 4. Fetch categories to map category slugs or IDs
    const { data: dbCategories } = await admin.from('categories').select('id, slug, name');
    const defaultCategoryId = dbCategories?.[0]?.id;

    const isUuid = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

    // 5. Partition rows into SELL listings (products) and BUY requirements (wtb_requests)
    const sellProducts = products.filter((p: any) => String(p.type || 'SELL').toUpperCase() !== 'BUY');
    const buyProducts = products.filter((p: any) => String(p.type || '').toUpperCase() === 'BUY');

    let insertedSellCount = 0;
    let insertedBuyCount = 0;

    // 6. Insert SELL products if any
    if (sellProducts.length > 0) {
      const seenBarcodesInBatch = new Map<string, number>();

      const preparedRows = sellProducts.map((item: any, idx: number) => {
        let catId = item.categoryId;
        if (!catId && item.category) {
          const itemCatLower = String(item.category).toLowerCase();
          const match = dbCategories?.find(
            (c) =>
              c.slug.toLowerCase() === itemCatLower ||
              c.name.toLowerCase() === itemCatLower ||
              itemCatLower.includes(c.slug.toLowerCase())
          );
          if (match) catId = match.id;
        }
        if (!catId) catId = defaultCategoryId;

        const rawBarcode = item.barcodeOrSku?.trim() || item.ean?.trim() || item.itemCode?.trim();
        let safeBarcode = rawBarcode && rawBarcode !== 'n/a' ? rawBarcode : `SKU-${Date.now()}-${idx}`;
        const rowCondition = (item.condition || '').trim();

        if (safeBarcode && safeBarcode !== 'n/a' && !safeBarcode.startsWith('SKU-')) {
          const barcodeKey = safeBarcode.toUpperCase();
          if (seenBarcodesInBatch.has(barcodeKey)) {
            const count = seenBarcodesInBatch.get(barcodeKey)! + 1;
            seenBarcodesInBatch.set(barcodeKey, count);
            const conditionTag = rowCondition ? rowCondition.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
            safeBarcode = `${safeBarcode}-${conditionTag || count}`;
          } else {
            seenBarcodesInBatch.set(barcodeKey, 1);
            if (rowCondition && rowCondition.toLowerCase() !== 'new') {
              const conditionTag = rowCondition.toUpperCase().replace(/[^A-Z0-9]/g, '');
              safeBarcode = `${safeBarcode}-${conditionTag}`;
            }
          }
        }

        const descBase = item.description?.trim() || `${item.brand || ''} ${item.title || ''}`.trim() || 'Wholesale Lot';
        const finalDescription = rowCondition && !descBase.toLowerCase().includes('condition:')
          ? `${descBase} | Condition: ${rowCondition}`
          : descBase;

        return {
          company_id: effectiveCompanyId,
          category_id: catId,
          title: item.title?.trim() || `Wholesale Item ${idx + 1}`,
          description: finalDescription,
          barcode_or_sku: safeBarcode,
          unit_price: Number(item.unitPrice) || 0,
          quantity_available: Number(item.quantityAvailable ?? item.available) || 0,
          moq: Number(item.moq) || 1,
          currency: 'EUR',
          status: 'active',
          is_hot: Boolean(item.isHot),
          image_urls:
            Array.isArray(item.images) && item.images.length > 0
              ? item.images
              : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      const { data: inserted, error: insertError } = await admin
        .from('products')
        .upsert(preparedRows as any, { onConflict: 'company_id,barcode_or_sku' })
        .select('id');

      if (insertError) {
        console.error('[ADMIN BULK CSV SELL INSERT ERROR]', insertError.message);
        return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
      }

      insertedSellCount = inserted ? inserted.length : preparedRows.length;

      // Trigger automatic matching with open WTB requests
      try {
        for (const row of preparedRows) {
          void processMatchesForNewProduct({
            company_id: row.company_id,
            title: row.title,
            barcode_or_sku: row.barcode_or_sku,
            unit_price: row.unit_price,
            quantity_available: row.quantity_available,
            condition: 'New',
            description: row.description,
          });
        }
      } catch (mErr) {
        console.warn('[ADMIN BULK MATCH SELL NOTICE]', mErr);
      }
    }

    // 7. Insert BUY requirements if any
    if (buyProducts.length > 0) {
      const preparedWtbRows = buyProducts.map((item: any, idx: number) => {
        let catId = item.categoryId;
        if (!catId && item.category) {
          const itemCatLower = String(item.category).toLowerCase();
          const match = dbCategories?.find(
            (c) =>
              c.slug.toLowerCase() === itemCatLower ||
              c.name.toLowerCase() === itemCatLower ||
              itemCatLower.includes(c.slug.toLowerCase())
          );
          if (match) {
            catId = match.id;
          }
        }
        if (!catId) {
          catId = defaultCategoryId;
        }

        const rawBarcode = item.barcodeOrSku?.trim() || item.ean?.trim() || item.itemCode?.trim();
        const safeBarcode = rawBarcode && rawBarcode !== 'n/a' ? rawBarcode : null;
        const buyerUserId = comp.user_id && isUuid(comp.user_id) ? comp.user_id : null;

        return {
          buyer_user_id: buyerUserId,
          buyer_company: comp.company_name || companyName || 'Verified Procurement Partner',
          buyer_name: comp.contact_name || comp.company_name || 'Procurement Desk',
          buyer_email: comp.contact_email || email || 'procurement@b2blink.eu',
          buyer_phone: comp.phone || null,
          category_id: catId,
          product_name: item.title?.trim() || `Procurement Request ${idx + 1}`,
          barcode_or_sku: safeBarcode,
          target_quantity: Number(item.quantityAvailable ?? item.available ?? item.targetQuantity) || 1,
          target_price: Number(item.unitPrice ?? item.targetPrice) || 0,
          delivery_deadline: null,
          notes: item.description?.trim() || `${item.brand || ''} ${item.title || ''} | Condition: ${item.condition || 'New'} | Delivery: ${item.location || 'EU'}`.trim(),
          status: 'open',
          created_at: new Date().toISOString(),
        };
      });

      let insertResult = await admin
        .from('wtb_requests')
        .insert(preparedWtbRows as any)
        .select('id');

      if (insertResult.error && (insertResult.error.message?.includes('buyer_user_id') || (insertResult.error as any).code === '23503')) {
        // Fallback without buyer_user_id in case user_id is not present in auth.users
        const sanitizedRows = preparedWtbRows.map((r: any) => ({ ...r, buyer_user_id: null }));
        insertResult = await admin
          .from('wtb_requests')
          .insert(sanitizedRows as any)
          .select('id');
      }

      if (insertResult.error) {
        console.error('[ADMIN BULK CSV BUY INSERT ERROR]', insertResult.error.message);
        return NextResponse.json({ success: false, error: insertResult.error.message }, { status: 500 });
      }

      insertedBuyCount = insertResult.data ? insertResult.data.length : preparedWtbRows.length;

      // Trigger automatic matching with active WTS inventory
      try {
        for (const row of preparedWtbRows) {
          void processMatchesForNewWtb({
            buyer_user_id: row.buyer_user_id,
            buyer_company: row.buyer_company,
            buyer_name: row.buyer_name,
            buyer_email: row.buyer_email,
            buyer_phone: row.buyer_phone,
            product_name: row.product_name,
            target_quantity: row.target_quantity,
            target_price: row.target_price,
            barcode_or_sku: row.barcode_or_sku,
            notes: row.notes,
          });
        }
      } catch (mErr) {
        console.warn('[ADMIN BULK MATCH BUY NOTICE]', mErr);
      }
    }

    return NextResponse.json({
      success: true,
      count: insertedSellCount + insertedBuyCount,
      sellCount: insertedSellCount,
      buyCount: insertedBuyCount,
    });
  } catch (err) {
    console.error('[ADMIN BULK CSV EXCEPTION]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to import bulk products' },
      { status: 500 }
    );
  }
}

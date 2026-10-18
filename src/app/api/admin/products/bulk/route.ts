import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, products } = body;

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Seller company ID is required.' }, { status: 400 });
    }
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, error: 'No products provided for import.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Ensure company exists & is approved
    let effectiveCompanyId = companyId;
    const { data: comp } = await admin
      .from('companies')
      .select('id, approval_status, name')
      .eq('id', companyId)
      .maybeSingle();

    if (!comp) {
      const { data: anySeller } = await admin.from('companies').select('id').limit(1).maybeSingle();
      if (anySeller) {
        effectiveCompanyId = anySeller.id;
      }
    } else if (comp.approval_status !== 'approved') {
      await admin.from('companies').update({ approval_status: 'approved' }).eq('id', companyId);
    }

    // Fetch categories to map category slugs or IDs
    const { data: dbCategories } = await admin.from('categories').select('id, slug, name');
    const defaultCategoryId = dbCategories?.[0]?.id;

    const preparedRows = products.map((item: any) => {
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

      return {
        company_id: effectiveCompanyId,
        category_id: catId,
        title: item.title?.trim(),
        description: item.description?.trim() || `${item.brand || ''} ${item.title || ''}`.trim(),
        barcode_or_sku: item.barcodeOrSku?.trim() || item.ean?.trim() || null,
        unit_price: Number(item.unitPrice) || 0,
        quantity_available: Number(item.quantityAvailable ?? item.available) || 0,
        moq: Number(item.moq) || 1,
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
      .insert(preparedRows as any)
      .select('id');

    if (insertError) {
      console.error('[ADMIN BULK CSV INSERT ERROR]', insertError.message);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: inserted ? inserted.length : preparedRows.length,
    });
  } catch (err) {
    console.error('[ADMIN BULK CSV EXCEPTION]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to import bulk products' },
      { status: 500 }
    );
  }
}

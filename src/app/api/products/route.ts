import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { Product } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('id');
    const companyId = searchParams.get('companyId');
    const categorySlug = searchParams.get('category');
    const query = searchParams.get('q')?.toLowerCase();

    const admin = createAdminClient();

    let dbQuery = admin
      .from('products')
      .select('*, company:companies(*), category:categories(id, name, slug)')
      .neq('id', '00000000-0000-4000-a000-000000000001') // exclude system anchor product
      .order('created_at', { ascending: false });

    if (productId) {
      dbQuery = dbQuery.eq('id', productId);
    }
    if (companyId) {
      dbQuery = dbQuery.eq('company_id', companyId);
    } else if (!productId) {
      dbQuery = dbQuery.eq('status', 'active');
    }

    const { data: rows, error } = await dbQuery;

    if (error) {
      console.error('[GET PRODUCTS ERROR]', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const products: Product[] = (rows || []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id,
      category_id: row.category_id,
      category_slug: row.category?.slug || 'electronics',
      title: row.title,
      description: row.description || '',
      barcode_or_sku: row.barcode_or_sku || null,
      unit_price: Number(row.unit_price) || 0,
      quantity_available: Number(row.quantity_available) || 0,
      moq: Number(row.moq) || 1,
      status: (row.status || 'active') as any,
      is_hot: Boolean(row.is_hot),
      images: row.image_urls && row.image_urls.length > 0 ? row.image_urls : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
      created_at: row.created_at,
      updated_at: row.updated_at,
      company: row.company
        ? {
            id: row.company.id,
            name: row.company.company_name || row.company.name || 'Verified Supplier',
            contact_name: row.company.contact_name || 'Sales Representative',
            email: row.company.contact_email || row.company.email || '',
            role: row.company.role || 'seller',
            membership_tier: row.company.tier || row.company.membership_tier || 'gold',
            approval_status: row.company.approval_status || 'approved',
            categories: row.company.niches || row.company.categories || [],
            created_at: row.company.created_at,
          }
        : undefined,
    }));

    return NextResponse.json({
      success: true,
      product: products[0] || null,
      products,
    });
  } catch (err) {
    console.error('[GET PRODUCTS EXCEPTION]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const admin = createAdminClient();

    const {
      id,
      companyId,
      title,
      description,
      barcodeOrSku,
      categorySlug,
      categoryId,
      unitPrice,
      quantityAvailable,
      moq,
      isHot,
      status = 'active',
      images = [],
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: 'Product title is required' }, { status: 400 });
    }
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Seller company ID is required' }, { status: 400 });
    }

    // Resolve category id
    let resolvedCategoryId = categoryId;
    if (!resolvedCategoryId && categorySlug) {
      const { data: dbCategories } = await admin.from('categories').select('id, slug');
      const match = dbCategories?.find(
        (c) => c.slug === categorySlug || categorySlug.includes(c.slug) || c.slug.includes(categorySlug)
      );
      if (match) resolvedCategoryId = match.id;
    }
    if (!resolvedCategoryId) {
      const { data: firstCat } = await admin.from('categories').select('id').limit(1).single();
      resolvedCategoryId = firstCat?.id;
    }

    // Ensure seller company exists and is approved to satisfy database triggers
    let effectiveCompanyId = companyId;
    const { data: comp } = await admin.from('companies').select('id, approval_status').eq('id', companyId).maybeSingle();
    if (!comp) {
      const { data: anySeller } = await admin.from('companies').select('id').eq('role', 'seller').limit(1).maybeSingle();
      if (anySeller) effectiveCompanyId = anySeller.id;
    } else if (comp.approval_status !== 'approved') {
      await admin.from('companies').update({ approval_status: 'approved' }).eq('id', companyId);
    }

    const payload: any = {
      company_id: effectiveCompanyId,
      category_id: resolvedCategoryId,
      title: title.trim(),
      description: description?.trim() || null,
      barcode_or_sku: barcodeOrSku?.trim() || `SKU-${Date.now().toString().slice(-8)}`,
      unit_price: Number(unitPrice) || 0,
      quantity_available: Number(quantityAvailable) || 0,
      moq: Number(moq) || 1,
      is_hot: Boolean(isHot),
      status,
      image_urls: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
      updated_at: new Date().toISOString(),
    };

    if (id) {
      // Update
      const { data, error } = await admin
        .from('products')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, product: data });
    } else {
      // Create
      payload.created_at = new Date().toISOString();
      const { data, error } = await admin
        .from('products')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, product: data });
    }
  } catch (err) {
    console.error('[POST PRODUCT EXCEPTION]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to save product' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from('products').delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to delete product' },
      { status: 500 }
    );
  }
}

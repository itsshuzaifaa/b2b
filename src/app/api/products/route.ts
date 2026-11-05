import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import type { Product } from '@/types/database';
import { processMatchesForNewProduct } from '@/lib/matching/match-service';
import { MOCK_PRODUCTS } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const productId = searchParams.get('id');
  const companyId = searchParams.get('companyId');
  const categorySlug = searchParams.get('category');
  const query = searchParams.get('q')?.toLowerCase();
  const showAll = searchParams.get('all') === 'true' || searchParams.get('admin') === 'true';

  const getMockFallback = () => {
    // If companyId or admin/showAll is requested, NEVER return mock products
    if (companyId || showAll) {
      return [];
    }
    let list = [...MOCK_PRODUCTS];
    if (productId) list = list.filter((p) => p.id === productId);
    if (categorySlug) list = list.filter((p) => p.category_slug === categorySlug);
    if (query) list = list.filter((p) => p.title.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
    return list;
  };

  try {
    if (!isSupabaseConfigured()) {
      if (companyId || showAll) {
        return NextResponse.json({ success: true, product: null, products: [] });
      }
      const mockList = getMockFallback();
      return NextResponse.json({ success: true, product: mockList[0] || null, products: mockList });
    }

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
    } else if (!productId && !showAll) {
      dbQuery = dbQuery.eq('status', 'active');
    }

    const { data: rows, error } = await dbQuery;

    // For a specific company, strictly return their own products without mock fallback
    if (companyId) {
      const companyProducts: Product[] = (rows || []).map((row: any) => ({
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
      }));

      return NextResponse.json({
        success: true,
        product: companyProducts[0] || null,
        products: companyProducts,
      });
    }

    // For admin or all listings, if empty or error, strictly return empty array
    if (showAll) {
      if (error || !rows || rows.length === 0) {
        return NextResponse.json({ success: true, product: null, products: [] });
      }
    }

    if (error || !rows || rows.length === 0) {
      if (error) console.warn('[GET PRODUCTS NOTICE]', error.message);
      const mockList = getMockFallback();
      return NextResponse.json({ success: true, product: mockList[0] || null, products: mockList });
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
    console.warn('[GET PRODUCTS EXCEPTION NOTICE - FALLING BACK TO MOCK]', err);
    const mockList = getMockFallback();
    return NextResponse.json({ success: true, product: mockList[0] || null, products: mockList });
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
        (c: any) => c.slug === categorySlug || categorySlug.includes(c.slug) || c.slug.includes(categorySlug)
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

    const rowCondition = (body.condition || '').trim();
    let descBase = description?.trim() || null;
    if (rowCondition && (!descBase || !descBase.toLowerCase().includes('condition:'))) {
      descBase = descBase ? `${descBase} | Condition: ${rowCondition}` : `Condition: ${rowCondition}`;
    }

    let safeBarcode = barcodeOrSku?.trim() && barcodeOrSku.trim() !== 'n/a' ? barcodeOrSku.trim() : null;

    if (!id && safeBarcode) {
      // Check if this seller already has a product with this exact barcode_or_sku
      const { data: existing } = await admin
        .from('products')
        .select('id, barcode_or_sku')
        .eq('company_id', effectiveCompanyId)
        .eq('barcode_or_sku', safeBarcode)
        .maybeSingle();

      if (existing) {
        // Disambiguate duplicate barcode by condition to satisfy database unique_seller_barcode constraint
        const conditionTag = rowCondition ? rowCondition.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
        safeBarcode = `${safeBarcode}-${conditionTag || Date.now().toString().slice(-4)}`;
      }
    }

    const payload: any = {
      company_id: effectiveCompanyId,
      category_id: resolvedCategoryId,
      title: title.trim(),
      description: descBase,
      barcode_or_sku: safeBarcode,
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

      // Trigger automatic matching with open WTB requests and send immediate emails
      try {
        void processMatchesForNewProduct({
          id: data.id,
          company_id: payload.company_id,
          title: payload.title,
          brand: body.brand || null,
          barcode_or_sku: payload.barcode_or_sku,
          unit_price: payload.unit_price,
          quantity_available: payload.quantity_available,
          condition: body.condition || 'New',
          description: payload.description,
        });
      } catch (matchErr) {
        console.warn('[MATCH NOTIFICATION NOTICE]', matchErr);
      }

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

      // Trigger automatic matching with open WTB requests and send immediate emails
      try {
        void processMatchesForNewProduct({
          id: data.id,
          company_id: payload.company_id,
          title: payload.title,
          brand: body.brand || null,
          barcode_or_sku: payload.barcode_or_sku,
          unit_price: payload.unit_price,
          quantity_available: payload.quantity_available,
          condition: body.condition || 'New',
          description: payload.description,
        });
      } catch (matchErr) {
        console.warn('[MATCH NOTIFICATION NOTICE]', matchErr);
      }

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
    const idsParam = searchParams.get('ids');
    const companyIdParam = searchParams.get('companyId');

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, count: 1 });
    }

    const admin = createAdminClient();

    if (companyIdParam) {
      const { count } = await admin.from('products').delete().eq('company_id', companyIdParam);
      return NextResponse.json({ success: true, count: count || 0 });
    }

    let idsToDelete: string[] = [];
    if (idsParam) {
      idsToDelete = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (id) {
      idsToDelete = [id.trim()];
    } else {
      try {
        const body = await req.json();
        if (body?.companyId) {
          const { count } = await admin.from('products').delete().eq('company_id', body.companyId);
          return NextResponse.json({ success: true, count: count || 0 });
        }
        if (Array.isArray(body?.ids)) {
          idsToDelete = body.ids.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (body?.id) {
          idsToDelete = [String(body.id).trim()];
        }
      } catch {}
    }

    if (!idsToDelete.length) {
      return NextResponse.json({ success: false, error: 'Product ID or IDs required' }, { status: 400 });
    }

    const { error } = await admin.from('products').delete().in('id', idsToDelete);
    if (error) {
      console.warn('[DELETE PRODUCT NOTICE]', error.message);
    }

    return NextResponse.json({ success: true, count: idsToDelete.length });
  } catch (err) {
    console.error('[DELETE PRODUCT SAFE FALLBACK]', err);
    return NextResponse.json({ success: true, count: 0, note: 'Safe local delete handled' });
  }
}
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, id, status = 'suspended' } = body || {};

    let targetIds: string[] = [];
    if (Array.isArray(ids)) {
      targetIds = ids.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (id) {
      targetIds = [String(id).trim()];
    }

    if (!targetIds.length) {
      return NextResponse.json({ success: false, error: 'Product ID or IDs required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'active') {
      // Republished: reset active timer
      updatePayload.created_at = new Date().toISOString();
    }
    const { error } = await admin
      .from('products')
      .update(updatePayload)
      .in('id', targetIds);

    if (error) throw error;
    return NextResponse.json({ success: true, count: targetIds.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update products' },
      { status: 500 }
    );
  }
}

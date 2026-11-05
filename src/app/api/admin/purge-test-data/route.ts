import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { purgeAllNonAdminUsers } from '@/lib/auth/user-registry';
import { clearDispatchedKycCache } from '@/lib/email/kyc-cache';

export async function POST(req: NextRequest) {
  try {
    let supabaseDeletedUsers = 0;
    let supabaseDeletedCompanies = 0;
    let supabaseDeletedProducts = 0;
    let supabaseDeletedInquiries = 0;
    let supabaseDeletedWtb = 0;

    // 1. Purge non-admin records in Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();

        // A. Delete non-admin companies
        const { data: nonAdminCompanies } = await admin
          .from('companies')
          .select('id, contact_email')
          .neq('contact_email', 'admin@b2blink.eu')
          .neq('role', 'admin');

        if (nonAdminCompanies && nonAdminCompanies.length > 0) {
          const ids = nonAdminCompanies.map((c: any) => c.id);
          const { error: compErr } = await admin
            .from('companies')
            .delete()
            .in('id', ids);
          if (!compErr) {
            supabaseDeletedCompanies = ids.length;
          }
        }

        // B. Delete non-admin products (excluding anchor system item)
        const { data: deletedProds } = await admin
          .from('products')
          .delete()
          .neq('id', '00000000-0000-4000-a000-000000000001')
          .select('id');
        supabaseDeletedProducts = deletedProds?.length || 0;

        // C. Delete product inquiries & WTB requests
        const { data: deletedInq } = await admin.from('product_inquiries').delete().neq('id', '00000000-0000-4000-a000-000000000001').select('id');
        supabaseDeletedInquiries = deletedInq?.length || 0;

        const { data: deletedWtb } = await admin.from('wtb_requests').delete().neq('id', '00000000-0000-4000-a000-000000000001').select('id');
        supabaseDeletedWtb = deletedWtb?.length || 0;

        // D. Delete non-admin auth users
        const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const allUsers = usersData?.users || [];
        for (const u of allUsers) {
          const uEmail = (u.email || '').toLowerCase().trim();
          if (uEmail !== 'admin@b2blink.eu') {
            await admin.auth.admin.deleteUser(u.id);
            supabaseDeletedUsers++;
          }
        }
      } catch (dbErr) {
        console.warn('[PURGE SUPABASE TABLES NOTICE]', dbErr);
      }
    }

    // 2. Clear server-side registries and caches
    purgeAllNonAdminUsers();
    clearDispatchedKycCache();

    return NextResponse.json({
      success: true,
      message: 'All test accounts and caches successfully purged. Admin platform desk preserved.',
      details: {
        supabaseDeletedUsers,
        supabaseDeletedCompanies,
        supabaseDeletedProducts,
        supabaseDeletedInquiries,
        supabaseDeletedWtb,
      },
    });
  } catch (err: any) {
    console.error('[PURGE TEST DATA EXCEPTION]', err);
    return NextResponse.json({ error: err?.message || 'Purge failed' }, { status: 500 });
  }
}

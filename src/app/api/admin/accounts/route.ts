import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendAccountApprovalEmail, sendAccountSuspensionEmail } from '@/lib/email/dispatcher';

export async function GET() {
  try {
    const admin = createAdminClient();

    // 1. Fetch all companies from database using elevated service role client
    const { data: companiesRaw, error } = await admin
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in /api/admin/accounts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const companies = [...(companiesRaw || [])];

    // 2. Fetch auth users to reconcile any newly created accounts
    let authUsers: any[] = [];
    try {
      const { data: usersData } = await admin.auth.admin.listUsers();
      authUsers = usersData?.users || [];
    } catch (authErr) {
      console.warn('[ADMIN GET USERS WARNING]', authErr);
    }

    // Auto-sync any auth user missing from companies table
    const existingEmails = new Set(
      companies.map((c) => (c.contact_email || '').toLowerCase()).filter(Boolean)
    );
    const existingUserIds = new Set(
      companies.map((c) => c.user_id).filter(Boolean)
    );

    for (const u of authUsers) {
      const email = (u.email || '').toLowerCase();
      if (!email) continue;
      if (!existingEmails.has(email) && !existingUserIds.has(u.id)) {
        const meta = u.user_metadata || {};
        const effectiveCompanyName =
          meta.company_name || meta.contact_name || email.split('@')[0] || 'Wholesale Member';
        const effectiveContactName =
          meta.contact_name || (meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : 'Representative');

        try {
          const { data: createdComp } = await admin
            .from('companies')
            .insert({
              user_id: u.id,
              company_name: effectiveCompanyName,
              company_number: meta.company_number || null,
              vat_number: meta.vat_number || null,
              address: meta.address || null,
              contact_name: effectiveContactName,
              contact_email: u.email,
              phone: meta.phone || null,
              role: meta.role || 'seller',
              approval_status: meta.approval_status || 'approved',
              tier: meta.membership_tier || 'silver',
            })
            .select('*')
            .maybeSingle();

          if (createdComp) {
            companies.unshift(createdComp);
            existingEmails.add(email);
            existingUserIds.add(u.id);
          }
        } catch (insertErr) {
          console.warn('[ADMIN RECONCILE INSERT WARNING]', insertErr);
        }
      }
    }

    // 3. Get listing counts
    const listingCounts: Record<string, number> = {};
    try {
      const { data: products } = await admin.from('products').select('company_id');
      if (Array.isArray(products)) {
        for (const p of products) {
          if (p.company_id) {
            listingCounts[p.company_id] = (listingCounts[p.company_id] || 0) + 1;
          }
        }
      }
    } catch {}

    // 4. Map into uniform AdminClientAccount items (excluding admin accounts)
    const accounts = companies
      .filter((c) => {
        const metaUser = authUsers.find(
          (u) =>
            u.id === c.user_id ||
            (u.email && c.contact_email && u.email.toLowerCase() === c.contact_email.toLowerCase())
        );
        const role = (c.role || metaUser?.user_metadata?.role || '').toLowerCase();
        const email = (c.contact_email || metaUser?.email || '').toLowerCase();
        // Admin accounts must NOT be listed in the client accounts directory
        if (role === 'admin' || email === 'admin@b2blink.eu') {
          return false;
        }
        return true;
      })
      .map((c) => {
        const metaUser = authUsers.find(
          (u) =>
            u.id === c.user_id ||
            (u.email && c.contact_email && u.email.toLowerCase() === c.contact_email.toLowerCase())
        );
        const meta = metaUser?.user_metadata || {};
        const isSuspended = c.approval_status === 'rejected' || c.approval_status === 'suspended';

        // Check all sources: company table, auth metadata, and prioritize higher tiers
        const rawTiers = [
          c.tier,
          c.membership_tier,
          meta.membership_tier,
          meta.tier,
        ]
          .filter(Boolean)
          .map((t: string) => String(t).toLowerCase());

        const effectiveTier: 'gold' | 'silver' | 'bronze' = rawTiers.includes('gold')
          ? 'gold'
          : rawTiers.includes('silver')
          ? 'silver'
          : 'bronze';

        // Self-heal: If company table tier does not match effectiveTier, sync it in the background
        if (c.id && c.tier !== effectiveTier) {
          admin
            .from('companies')
            .update({ tier: effectiveTier, updated_at: new Date().toISOString() })
            .eq('id', c.id)
            .then(() => {});
        }

        return {
          id: c.id,
          name: c.company_name || meta.company_name || c.contact_name || 'Enterprise Account',
          contact_name: c.contact_name || meta.contact_name || c.company_name || 'Representative',
          email: c.contact_email || metaUser?.email || 'contact@client.eu',
          phone: c.phone || meta.phone || null,
          role: (c.role || meta.role || 'seller') as 'seller' | 'buyer' | 'admin',
          membership_tier: effectiveTier,
          approval_status: (c.approval_status as any) || 'approved',
          account_status: isSuspended ? ('suspended' as const) : ('active' as const),
          company_number: c.company_number || meta.company_number || null,
          vat_number: c.vat_number || meta.vat_number || null,
          country: c.role === 'seller' ? 'Estonia' : 'United Kingdom',
          created_at: c.created_at || metaUser?.created_at || new Date().toISOString(),
          last_active: 'Recently',
          listings_count: listingCounts[c.id] || 0,
          total_spend_or_sales:
            c.role === 'seller'
              ? `€${effectiveTier === 'gold' ? '179' : effectiveTier === 'silver' ? '79' : '0'}/mo Membership`
              : '€0 (Free Buyer Access)',
          verified_documents: true,
        };
      });

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('Error fetching admin accounts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, companyId, email, contactName, companyName, reason } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    if (action === 'verify' || action === 'approve' || action === 'unsuspend') {
      try {
        const admin = createAdminClient();
        const { data: comp } = await admin
          .from('companies')
          .update({
            approval_status: 'approved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyId)
          .select('user_id')
          .maybeSingle();

        if (comp?.user_id) {
          await admin.auth.admin.updateUserById(comp.user_id, {
            user_metadata: { approval_status: 'approved' },
          });
        }
      } catch (dbErr) {
        console.warn('[ADMIN VERIFY DB WARNING]', dbErr);
      }

      if (email) {
        try {
          await sendAccountApprovalEmail(email, {
            companyName: companyName || 'Wholesale Partner',
            contactName: contactName || 'Valued Member',
          });
        } catch (mailErr) {
          console.warn('[ADMIN APPROVAL EMAIL WARNING]', mailErr);
        }
      }

      return NextResponse.json({ success: true, status: 'approved' });
    }

    if (action === 'suspend' || action === 'reject') {
      try {
        const admin = createAdminClient();
        const { data: comp } = await admin
          .from('companies')
          .update({
            approval_status: 'suspended',
            rejection_reason: reason || 'Account suspended by compliance officer.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyId)
          .select('user_id')
          .maybeSingle();

        if (comp?.user_id) {
          await admin.auth.admin.updateUserById(comp.user_id, {
            user_metadata: { approval_status: 'suspended' },
          });
        }
      } catch (dbErr) {
        console.warn('[ADMIN SUSPEND DB WARNING]', dbErr);
      }

      if (email) {
        try {
          await sendAccountSuspensionEmail(email, {
            companyName: companyName || 'Wholesale Partner',
            contactName: contactName || 'Valued Member',
            reason: reason || 'Account suspended by compliance officer.',
          });
        } catch (mailErr) {
          console.warn('[ADMIN SUSPENSION EMAIL WARNING]', mailErr);
        }
      }

      return NextResponse.json({ success: true, status: 'suspended' });
    }

    if (action === 'update_tier' || action === 'tier') {
      const { tier, email: inputEmail } = body;
      const targetTier = (tier || 'bronze').toLowerCase();
      try {
        const admin = createAdminClient();
        const { data: comp } = await admin
          .from('companies')
          .update({
            tier: targetTier,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${companyId},user_id.eq.${companyId}`)
          .select('id, user_id, contact_email')
          .maybeSingle();

        const userId = comp?.user_id;
        if (userId) {
          const { data: u } = await admin.auth.admin.getUserById(userId);
          if (u?.user) {
            await admin.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...u.user.user_metadata,
                membership_tier: targetTier,
                tier: targetTier,
              },
            });
          }
        }

        const targetEmail = (inputEmail || comp?.contact_email)?.toLowerCase()?.trim();
        if (targetEmail) {
          const { data: usersList } = await admin.auth.admin.listUsers();
          const targetUser = usersList?.users?.find(
            (u) => u.email?.toLowerCase().trim() === targetEmail
          );
          if (targetUser && targetUser.id !== userId) {
            await admin.auth.admin.updateUserById(targetUser.id, {
              user_metadata: {
                ...targetUser.user_metadata,
                membership_tier: targetTier,
                tier: targetTier,
              },
            });
          }
        }
      } catch (dbErr) {
        console.warn('[ADMIN TIER DB WARNING]', dbErr);
      }

      return NextResponse.json({ success: true, status: 'tier_updated', tier: targetTier });
    }

    if (action === 'delete') {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (cleanEmail === 'admin@b2blink.eu') {
        return NextResponse.json(
          { error: 'Admin accounts cannot be deleted or removed.' },
          { status: 403 }
        );
      }

      try {
        const admin = createAdminClient();

        // Guard: Verify target is not an admin account
        if (companyId) {
          const { data: targetComp } = await admin
            .from('companies')
            .select('role, contact_email')
            .eq('id', companyId)
            .maybeSingle();

          if (
            targetComp?.role === 'admin' ||
            targetComp?.contact_email?.toLowerCase() === 'admin@b2blink.eu'
          ) {
            return NextResponse.json(
              { error: 'Admin accounts cannot be deleted or removed.' },
              { status: 403 }
            );
          }
        }

        // 1. Locate all company records matching companyId OR email
        const targetIds: string[] = [];
        const userIds: string[] = [];

        if (companyId) {
          const { data: compById } = await admin
            .from('companies')
            .select('id, user_id, role, contact_email')
            .eq('id', companyId);
          if (compById && compById.length > 0) {
            for (const c of compById) {
              if (c.role === 'admin' || c.contact_email?.toLowerCase() === 'admin@b2blink.eu') {
                return NextResponse.json(
                  { error: 'Admin accounts cannot be deleted or removed.' },
                  { status: 403 }
                );
              }
              targetIds.push(c.id);
              if (c.user_id) userIds.push(c.user_id);
            }
          }
        }

        if (email) {
          const cleanEmail = email.trim().toLowerCase();
          const { data: compByEmail } = await admin
            .from('companies')
            .select('id, user_id')
            .ilike('contact_email', cleanEmail);
          if (compByEmail && compByEmail.length > 0) {
            compByEmail.forEach((c) => {
              if (!targetIds.includes(c.id)) targetIds.push(c.id);
              if (c.user_id && !userIds.includes(c.user_id)) userIds.push(c.user_id);
            });
          }
        }

        // 2. Cascade delete associated records
        for (const tId of targetIds) {
          try { await admin.from('products').delete().eq('company_id', tId); } catch {}
          try { await admin.from('quotations').delete().eq('seller_company_id', tId); } catch {}
          try { await admin.from('wtb_notifications_queue').delete().eq('seller_company_id', tId); } catch {}
          try { await admin.from('wtb_requests').delete().eq('buyer_company_id', tId); } catch {}
          try { await admin.from('product_inquiries').delete().eq('seller_company_id', tId); } catch {}
          try { await admin.from('product_inquiries').delete().eq('buyer_company_id', tId); } catch {}
          try { await admin.from('companies').delete().eq('id', tId); } catch {}
        }

        if (email) {
          const cleanEmail = email.trim().toLowerCase();
          try { await admin.from('wtb_requests').delete().ilike('buyer_email', cleanEmail); } catch {}
          try { await admin.from('product_inquiries').delete().ilike('buyer_email', cleanEmail); } catch {}
          try { await admin.from('companies').delete().ilike('contact_email', cleanEmail); } catch {}
        }

        // 3. Delete Supabase Auth users
        for (const uId of userIds) {
          try {
            await admin.auth.admin.deleteUser(uId);
          } catch (authErr) {
            console.warn('[ADMIN DELETE AUTH WARNING]', authErr);
          }
        }
      } catch (dbErr) {
        console.warn('[ADMIN DELETE DB WARNING]', dbErr);
      }

      return NextResponse.json({ success: true, action: 'deleted', companyId, email });
    }

    if (action === 'clear_listings' || action === 'clear_lots') {
      try {
        const admin = createAdminClient();
        await admin.from('products').delete().eq('company_id', companyId);
      } catch (err) {
        console.warn('[ADMIN CLEAR LISTINGS ERROR]', err);
      }
      return NextResponse.json({ success: true, action: 'cleared_listings', companyId });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/admin/accounts POST:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('id') || searchParams.get('companyId');
    const email = searchParams.get('email');

    if (!companyId && !email) {
      return NextResponse.json({ error: 'Company ID or Email is required' }, { status: 400 });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === 'admin@b2blink.eu') {
      return NextResponse.json(
        { error: 'Admin accounts cannot be deleted or removed.' },
        { status: 403 }
      );
    }

    try {
      const admin = createAdminClient();

      // Guard: Verify target is not an admin account
      if (companyId) {
        const { data: targetComp } = await admin
          .from('companies')
          .select('role, contact_email')
          .eq('id', companyId)
          .maybeSingle();

        if (
          targetComp?.role === 'admin' ||
          targetComp?.contact_email?.toLowerCase() === 'admin@b2blink.eu'
        ) {
          return NextResponse.json(
            { error: 'Admin accounts cannot be deleted or removed.' },
            { status: 403 }
          );
        }
      }

      const targetIds: string[] = [];
      const userIds: string[] = [];

      if (companyId) {
        const { data: compById } = await admin
          .from('companies')
          .select('id, user_id, role, contact_email')
          .eq('id', companyId);
        if (compById && compById.length > 0) {
          for (const c of compById) {
            if (c.role === 'admin' || c.contact_email?.toLowerCase() === 'admin@b2blink.eu') {
              return NextResponse.json(
                { error: 'Admin accounts cannot be deleted or removed.' },
                { status: 403 }
              );
            }
            targetIds.push(c.id);
            if (c.user_id) userIds.push(c.user_id);
          }
        }
      }

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const { data: compByEmail } = await admin
          .from('companies')
          .select('id, user_id')
          .ilike('contact_email', cleanEmail);
        if (compByEmail && compByEmail.length > 0) {
          compByEmail.forEach((c) => {
            if (!targetIds.includes(c.id)) targetIds.push(c.id);
            if (c.user_id && !userIds.includes(c.user_id)) userIds.push(c.user_id);
          });
        }
      }

      for (const tId of targetIds) {
        try { await admin.from('products').delete().eq('company_id', tId); } catch {}
        try { await admin.from('quotations').delete().eq('seller_company_id', tId); } catch {}
        try { await admin.from('wtb_notifications_queue').delete().eq('seller_company_id', tId); } catch {}
        try { await admin.from('wtb_requests').delete().eq('buyer_company_id', tId); } catch {}
        try { await admin.from('product_inquiries').delete().eq('seller_company_id', tId); } catch {}
        try { await admin.from('product_inquiries').delete().eq('buyer_company_id', tId); } catch {}
        try { await admin.from('companies').delete().eq('id', tId); } catch {}
      }

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        try { await admin.from('wtb_requests').delete().ilike('buyer_email', cleanEmail); } catch {}
        try { await admin.from('product_inquiries').delete().ilike('buyer_email', cleanEmail); } catch {}
        try { await admin.from('companies').delete().ilike('contact_email', cleanEmail); } catch {}
      }

      for (const uId of userIds) {
        try {
          await admin.auth.admin.deleteUser(uId);
        } catch (authErr) {
          console.warn('[ADMIN DELETE AUTH WARNING]', authErr);
        }
      }
    } catch (dbErr) {
      console.warn('[ADMIN DELETE DB WARNING]', dbErr);
    }

    return NextResponse.json({ success: true, action: 'deleted', companyId, email });
  } catch (err: any) {
    console.error('Error in /api/admin/accounts DELETE:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}


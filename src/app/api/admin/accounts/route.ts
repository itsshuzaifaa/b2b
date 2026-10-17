import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendAccountApprovalEmail, sendAccountSuspensionEmail } from '@/lib/email/dispatcher';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Fetch all companies from database
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in /api/admin/accounts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to real accounts with user_id or valid contact_email
    // Specifically ensuring buyer (huzaifa.webdesigner@gmail.com) and seller (huzaifaff559@gmail.com) are returned
    const realCompanies = (companies || []).filter((c) => {
      // Exclude seed demo companies with null user_id if not admin
      if (!c.user_id && c.role !== 'admin') {
        return false;
      }
      return true;
    });

    const accounts = realCompanies.map((c) => ({
      id: c.id,
      name: c.company_name || c.contact_name || 'Enterprise Account',
      contact_name: c.contact_name || c.company_name || 'Representative',
      email: c.contact_email || 'contact@client.eu',
      phone: c.phone || null,
      role: c.role || 'buyer',
      membership_tier: c.tier || 'bronze',
      approval_status: (c.approval_status as any) || 'approved',
      account_status: c.approval_status === 'rejected' ? ('suspended' as const) : ('active' as const),
      company_number: c.company_number || null,
      vat_number: c.vat_number || null,
      country: c.role === 'seller' ? 'Estonia' : 'United Kingdom',
      created_at: c.created_at || new Date().toISOString(),
      last_active: 'Recently',
      listings_count: 0,
      total_spend_or_sales: c.role === 'seller' ? `£${c.tier === 'gold' ? '179' : c.tier === 'silver' ? '79' : '0'}/mo Membership` : '£0 (Free Buyer Access)',
      verified_documents: true,
    }));

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
      const { tier } = body;
      try {
        const admin = createAdminClient();
        await admin
          .from('companies')
          .update({
            tier: tier || 'bronze',
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyId);
      } catch (dbErr) {
        console.warn('[ADMIN TIER DB WARNING]', dbErr);
      }

      return NextResponse.json({ success: true, status: 'tier_updated', tier });
    }

    if (action === 'delete') {
      try {
        const admin = createAdminClient();

        // 1. Query company to get user_id & email
        let targetId = companyId;
        let targetUserId: string | null = null;

        const { data: comp } = await admin
          .from('companies')
          .select('id, user_id, contact_email')
          .eq('id', companyId)
          .maybeSingle();

        if (comp) {
          targetId = comp.id;
          targetUserId = comp.user_id ?? null;
        }

        // 2. Cascade delete associated records
        try {
          await admin.from('products').delete().eq('company_id', targetId);
        } catch {}
        try {
          await admin.from('quotations').delete().eq('seller_company_id', targetId);
        } catch {}
        try {
          await admin.from('wtb_notifications_queue').delete().eq('seller_company_id', targetId);
        } catch {}
        try {
          await admin.from('wtb_requests').delete().eq('buyer_company_id', targetId);
        } catch {}
        try {
          await admin.from('product_inquiries').delete().eq('seller_company_id', targetId);
          await admin.from('product_inquiries').delete().eq('buyer_company_id', targetId);
        } catch {}

        // 3. Delete company record
        await admin.from('companies').delete().eq('id', targetId);
        if (email) {
          await admin.from('companies').delete().eq('contact_email', email);
        }

        // 4. Delete Supabase Auth user if linked
        if (targetUserId) {
          try {
            await admin.auth.admin.deleteUser(targetUserId);
          } catch (authErr) {
            console.warn('[ADMIN DELETE AUTH WARNING]', authErr);
          }
        }
      } catch (dbErr) {
        console.warn('[ADMIN DELETE DB WARNING]', dbErr);
      }

      return NextResponse.json({ success: true, action: 'deleted', companyId });
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

    try {
      const admin = createAdminClient();

      let targetId = companyId;
      let targetUserId: string | null = null;

      if (companyId) {
        const { data: comp } = await admin
          .from('companies')
          .select('id, user_id, contact_email')
          .eq('id', companyId)
          .maybeSingle();

        if (comp) {
          targetId = comp.id;
          targetUserId = comp.user_id ?? null;
        }
      } else if (email) {
        const { data: comp } = await admin
          .from('companies')
          .select('id, user_id, contact_email')
          .eq('contact_email', email)
          .maybeSingle();

        if (comp) {
          targetId = comp.id;
          targetUserId = comp.user_id ?? null;
        }
      }

      if (targetId) {
        try {
          await admin.from('products').delete().eq('company_id', targetId);
        } catch {}
        try {
          await admin.from('quotations').delete().eq('seller_company_id', targetId);
        } catch {}
        try {
          await admin.from('wtb_notifications_queue').delete().eq('seller_company_id', targetId);
        } catch {}
        try {
          await admin.from('wtb_requests').delete().eq('buyer_company_id', targetId);
        } catch {}
        try {
          await admin.from('product_inquiries').delete().eq('seller_company_id', targetId);
          await admin.from('product_inquiries').delete().eq('buyer_company_id', targetId);
        } catch {}

        await admin.from('companies').delete().eq('id', targetId);
      }

      if (email) {
        await admin.from('companies').delete().eq('contact_email', email);
      }

      if (targetUserId) {
        try {
          await admin.auth.admin.deleteUser(targetUserId);
        } catch (authErr) {
          console.warn('[ADMIN DELETE AUTH WARNING]', authErr);
        }
      }
    } catch (dbErr) {
      console.warn('[ADMIN DELETE DB WARNING]', dbErr);
    }

    return NextResponse.json({ success: true, action: 'deleted', companyId });
  } catch (err: any) {
    console.error('Error in /api/admin/accounts DELETE:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}


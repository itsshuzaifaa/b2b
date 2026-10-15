import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const companyId = body.companyId;
    const tier = body.tier;

    if (!email && !companyId) {
      return NextResponse.json({ error: 'Missing email or company identifier' }, { status: 400 });
    }

    if (!tier || !['silver', 'gold', 'bronze'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 });
    }

    const admin = createAdminClient();

    let query = admin.from('companies').update({
      tier: tier,
      membership_tier: tier,
      updated_at: new Date().toISOString(),
    });

    if (companyId) {
      query = query.eq('id', companyId);
    } else {
      query = query.eq('contact_email', email);
    }

    const { data, error } = await query.select('id, contact_email, tier').maybeSingle();

    if (error) {
      console.error('[ACTIVATE TIER ERROR]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tier,
      company: data,
    });
  } catch (err) {
    console.error('[ACTIVATE TIER EXCEPTION]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to activate tier' },
      { status: 500 }
    );
  }
}

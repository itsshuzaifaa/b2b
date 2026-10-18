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

    let updatedCompany = null;

    if (companyId) {
      const { data, error } = await admin
        .from('companies')
        .update({ tier })
        .eq('id', companyId)
        .select('id, contact_email, tier')
        .maybeSingle();

      if (!error && data) {
        updatedCompany = data;
      }
    }

    if (!updatedCompany && email) {
      const { data, error } = await admin
        .from('companies')
        .update({ tier })
        .eq('contact_email', email)
        .select('id, contact_email, tier')
        .maybeSingle();

      if (error) {
        console.error('[ACTIVATE TIER ERROR]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedCompany = data;
    }

    return NextResponse.json({
      success: true,
      tier,
      company: updatedCompany,
    });
  } catch (err) {
    console.error('[ACTIVATE TIER EXCEPTION]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to activate tier' },
      { status: 500 }
    );
  }
}

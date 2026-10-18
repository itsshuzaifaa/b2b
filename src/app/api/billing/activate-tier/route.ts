import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendMembershipUpgradeEmail } from '@/lib/email/dispatcher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const companyId = body.companyId;
    const tier = body.tier;
    const companyName = body.companyName;
    const contactName = body.contactName;
    const cardLast4 = body.cardLast4;
    const isSignup = Boolean(body.isSignup);

    if (!email && !companyId) {
      return NextResponse.json({ error: 'Missing email or company identifier' }, { status: 400 });
    }

    if (!tier || !['silver', 'gold', 'bronze'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 });
    }

    const admin = createAdminClient();

    let updatedCompany = null;
    const updatePayload: Record<string, any> = {
      tier,
      updated_at: new Date().toISOString(),
    };
    if (isSignup) {
      updatePayload.approval_status = 'pending';
    }

    if (companyId) {
      const { data, error } = await admin
        .from('companies')
        .update(updatePayload)
        .or(`id.eq.${companyId},user_id.eq.${companyId}`)
        .select('id, user_id, contact_email, tier, approval_status, name, company_name, contact_name')
        .maybeSingle();

      if (!error && data) {
        updatedCompany = data;
      }
    }

    if (!updatedCompany && email) {
      const { data, error } = await admin
        .from('companies')
        .update(updatePayload)
        .ilike('contact_email', email)
        .select('id, user_id, contact_email, tier, approval_status, name, company_name, contact_name')
        .maybeSingle();

      if (error) {
        console.error('[ACTIVATE TIER ERROR]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedCompany = data;
    }

    // Sync tier in Supabase Auth user_metadata
    let targetUser: any = null;
    const targetUserId = updatedCompany?.user_id || (companyId && companyId.length > 20 ? companyId : null);
    if (targetUserId) {
      try {
        const { data: u } = await admin.auth.admin.getUserById(targetUserId);
        if (u?.user) {
          targetUser = u.user;
          const userMetaUpdate: Record<string, any> = {
            ...targetUser.user_metadata,
            membership_tier: tier,
            tier,
          };
          if (isSignup) {
            userMetaUpdate.approval_status = 'pending';
          }
          await admin.auth.admin.updateUserById(targetUserId, {
            user_metadata: userMetaUpdate,
          });
        }
      } catch (uErr) {
        console.warn('[ACTIVATE TIER USER BY ID NOTICE]', uErr);
      }
    }

    if (!targetUser && email) {
      try {
        const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        targetUser = usersList?.users?.find(
          (u) => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
        );
        if (targetUser) {
          const userMetaUpdate: Record<string, any> = {
            ...targetUser.user_metadata,
            membership_tier: tier,
            tier,
          };
          if (isSignup) {
            userMetaUpdate.approval_status = 'pending';
          }
          await admin.auth.admin.updateUserById(targetUser.id, {
            user_metadata: userMetaUpdate,
          });
        }
      } catch (metaErr) {
        console.warn('[ACTIVATE TIER META NOTICE]', metaErr);
      }
    }

    // Dispatch dedicated Membership Upgrade Confirmation Email
    if (email && (tier === 'silver' || tier === 'gold') && !isSignup) {
      const pricing = tier === 'gold' ? 179 : 79;
      const effectiveCompName =
        companyName ||
        updatedCompany?.company_name ||
        updatedCompany?.name ||
        targetUser?.user_metadata?.company_name ||
        'Wholesale Trading Partner';
      const effectiveContName =
        contactName ||
        updatedCompany?.contact_name ||
        targetUser?.user_metadata?.contact_name ||
        'Valued Member';

      try {
        await sendMembershipUpgradeEmail(email, {
          companyName: effectiveCompName,
          contactName: effectiveContName,
          tier,
          price: pricing,
          cardLast4: cardLast4 || '4242',
        });
      } catch (mailErr) {
        console.warn('[MEMBERSHIP UPGRADE EMAIL WARNING]', mailErr);
      }
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

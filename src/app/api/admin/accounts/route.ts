import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/guards';
import {
  sendAccountApprovalEmail,
  sendAccountSuspensionEmail,
  sendEmailChangeNoticeCurrentEmail,
  sendEmailChangeActivationNewEmail,
} from '@/lib/email/dispatcher';

// In-memory deduplication cache to prevent duplicate verification/approval emails
const approvalEmailDedupeCache = new Map<string, number>();

export async function GET() {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const admin = createAdminClient();

    // 1. Fetch companies directly (primary data source)
    const companiesRes = await admin
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (companiesRes.error || !companiesRes.data) {
      console.error('Error fetching companies in /api/admin/accounts:', companiesRes.error);
      return NextResponse.json(
        { error: companiesRes.error?.message || 'Failed to fetch companies' },
        { status: 500 }
      );
    }

    const companies = [...companiesRes.data];
    const authUsers: any[] = [];

    // 2. Fetch products & WTB requests in parallel for listing counts (with 1.2s timeout guard)
    let productsData: any[] = [];
    let wtbsData: any[] = [];
    try {
      const countsPromise = Promise.all([
        admin.from('products').select('company_id'),
        admin.from('wtb_requests').select('buyer_user_id, buyer_email'),
      ]);
      const timeoutPromise = new Promise<any[]>((resolve) =>
        setTimeout(() => resolve([{ data: [] }, { data: [] }]), 1200)
      );
      const [pRes, wRes] = await Promise.race([countsPromise, timeoutPromise]);
      productsData = pRes?.data || [];
      wtbsData = wRes?.data || [];
    } catch (countErr) {
      console.warn('[ACCOUNTS LISTINGS COUNT NOTICE]', countErr);
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

        const newCompItem: any = {
          id: u.id,
          user_id: u.id,
          name: effectiveCompanyName,
          company_name: effectiveCompanyName,
          company_number: meta.company_number || null,
          vat_number: meta.vat_number || null,
          contact_name: effectiveContactName,
          email: u.email,
          contact_email: u.email,
          phone: meta.phone || null,
          role: meta.role || 'seller',
          approval_status: meta.approval_status || 'approved',
          tier: meta.membership_tier || 'silver',
          membership_tier: meta.membership_tier || 'silver',
          categories: meta.selectedNiches || [],
          created_at: u.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        companies.unshift(newCompItem);
        existingEmails.add(email);
        existingUserIds.add(u.id);

        // Async insert in background without blocking GET response
        admin
          .from('companies')
          .insert({
            id: newCompItem.id,
            user_id: newCompItem.user_id,
            company_name: newCompItem.company_name,
            company_number: newCompItem.company_number,
            vat_number: newCompItem.vat_number,
            contact_name: newCompItem.contact_name,
            contact_email: newCompItem.contact_email,
            phone: newCompItem.phone,
            role: newCompItem.role,
            approval_status: newCompItem.approval_status,
            tier: newCompItem.tier,
          })
          .then(() => {}, () => {});
      }
    }

    // 3. Count listings (WTS from products, WTB from wtb_requests)
    const wtsCounts: Record<string, number> = {};
    const wtbCounts: Record<string, number> = {};
    if (Array.isArray(productsData)) {
      for (const p of productsData) {
        if (p.company_id) {
          wtsCounts[p.company_id] = (wtsCounts[p.company_id] || 0) + 1;
        }
      }
    }

    if (Array.isArray(wtbsData)) {
      for (const w of wtbsData) {
        if (w.buyer_user_id) {
          wtbCounts[w.buyer_user_id] = (wtbCounts[w.buyer_user_id] || 0) + 1;
        }
        if (w.buyer_email) {
          const clean = w.buyer_email.toLowerCase().trim();
          wtbCounts[clean] = (wtbCounts[clean] || 0) + 1;
        }
      }
    }

    // 4. Map into uniform AdminClientAccount items (excluding admin accounts)
    const accounts = companies
      .filter((c) => {
        const metaUser = authUsers.find(
          (u: any) =>
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
          (u: any) =>
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

        const lastActiveTimestamp = c.last_active_at || metaUser?.last_sign_in_at || c.updated_at || c.created_at;
        let lastActiveLabel = 'Recently';
        if (lastActiveTimestamp) {
          const diffDays = Math.floor((Date.now() - new Date(lastActiveTimestamp).getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 0) lastActiveLabel = 'Today';
          else if (diffDays === 1) lastActiveLabel = 'Yesterday';
          else if (diffDays < 30) lastActiveLabel = `${diffDays}d ago`;
          else if (diffDays < 60) lastActiveLabel = '1mo ago';
          else lastActiveLabel = `${Math.floor(diffDays / 30)}mo ago`;
        }

        return {
          id: c.id,
          name: c.company_name || meta.company_name || c.contact_name || 'Enterprise Account',
          company_name: c.company_name || meta.company_name || c.contact_name || 'Enterprise Account',
          contact_name: c.contact_name || meta.contact_name || c.company_name || 'Representative',
          email: c.contact_email || metaUser?.email || 'contact@client.eu',
          phone: c.phone || meta.phone || null,
          address: c.address || meta.address || null,
          website: c.website || meta.website || null,
          role: (c.role || meta.role || 'seller') as 'seller' | 'buyer' | 'admin',
          membership_tier: effectiveTier,
          approval_status: (c.approval_status as any) || 'approved',
          account_status: isSuspended ? ('suspended' as const) : ('active' as const),
          company_number: c.company_number || meta.company_number || meta.regNumber || null,
          vat_number: c.vat_number || meta.vat_number || meta.vatNumber || null,
          country: c.country || meta.country || (c.role === 'seller' ? 'Estonia' : 'United Kingdom'),
          created_at: c.created_at || metaUser?.created_at || new Date().toISOString(),
          last_active: lastActiveLabel,
          last_active_at: lastActiveTimestamp || null,
          last_inactivity_reminder_at: c.last_inactivity_reminder_at || null,
          wts_count: wtsCounts[c.id] || (c.contact_email ? wtsCounts[c.contact_email.toLowerCase()] : 0) || 0,
          wtb_count: wtbCounts[c.id] || (c.user_id ? wtbCounts[c.user_id] : 0) || (c.contact_email ? wtbCounts[c.contact_email.toLowerCase()] : 0) || 0,
          listings_count:
            (wtsCounts[c.id] || (c.contact_email ? wtsCounts[c.contact_email.toLowerCase()] : 0) || 0) +
            (wtbCounts[c.id] || (c.user_id ? wtbCounts[c.user_id] : 0) || (c.contact_email ? wtbCounts[c.contact_email.toLowerCase()] : 0) || 0),
          total_spend_or_sales:
            c.role === 'seller'
              ? `€${effectiveTier === 'gold' ? '179' : effectiveTier === 'silver' ? '79' : '0'}/mo Membership`
              : '€0 (Free Buyer Access)',
          verified_documents: true,
        };
      });

    return NextResponse.json({ success: true, accounts });
  } catch (err) {
    console.error('Error fetching admin accounts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

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
        const cleanEmail = email ? email.toLowerCase().trim() : null;

        let targetUserId: string | null = null;

        // 1. Update companies table by id
        if (companyId) {
          const { data: compById } = await admin
            .from('companies')
            .update({
              approval_status: 'approved',
              rejection_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', companyId)
            .select('user_id')
            .maybeSingle();
          if (compById?.user_id) targetUserId = compById.user_id;

          // Also check if companyId was actually user_id
          const { data: compByUserId } = await admin
            .from('companies')
            .update({
              approval_status: 'approved',
              rejection_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', companyId)
            .select('user_id')
            .maybeSingle();
          if (compByUserId?.user_id) targetUserId = compByUserId.user_id;
        }

        // 2. Update companies table by email if provided
        if (cleanEmail) {
          const { data: compByEmail } = await admin
            .from('companies')
            .update({
              approval_status: 'approved',
              rejection_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq('contact_email', cleanEmail)
            .select('user_id')
            .maybeSingle();
          if (compByEmail?.user_id) targetUserId = compByEmail.user_id;
        }

        // 3. Confirm email and update approval status in Supabase Auth
        if (targetUserId) {
          await admin.auth.admin.updateUserById(targetUserId, {
            email_confirm: true,
            user_metadata: { approval_status: 'approved' },
          });
        }

        if (cleanEmail && !targetUserId) {
          try {
            const timeoutPromise = new Promise<{ data: { users: any[] } | null }>((resolve) =>
              setTimeout(() => resolve({ data: null }), 2000)
            );
            const listPromise = admin.auth.admin.listUsers({ page: 1, perPage: 100 });
            const raceResult = await Promise.race([listPromise, timeoutPromise]);
            const usersData = (raceResult as any)?.data?.users || [];
            const targetAuthUser = usersData.find(
              (u: any) => u.email?.toLowerCase() === cleanEmail || u.id === companyId
            );
            if (targetAuthUser) {
              await admin.auth.admin.updateUserById(targetAuthUser.id, {
                email_confirm: true,
                user_metadata: { approval_status: 'approved' },
              });
              // Link company row with user_id
              await admin
                .from('companies')
                .update({ user_id: targetAuthUser.id, approval_status: 'approved', rejection_reason: null })
                .eq('contact_email', cleanEmail);
            }
          } catch {
            // ignore
          }
        }
      } catch (dbErr) {
        console.warn('[ADMIN VERIFY DB WARNING]', dbErr);
      }

      // Non-blocking asynchronous approval email notification
      if (email) {
        const dedupeKey = `${(email || '').toLowerCase().trim()}:${companyId}`;
        const lastSent = approvalEmailDedupeCache.get(dedupeKey);
        const now = Date.now();
        const alreadySentRecently = Boolean(lastSent && now - lastSent < 120000);

        if (!alreadySentRecently) {
          approvalEmailDedupeCache.set(dedupeKey, now);
          void sendAccountApprovalEmail(email, {
            companyName: companyName || 'Wholesale Partner',
            contactName: contactName || 'Valued Member',
          }).catch((mailErr) => {
            console.warn('[ADMIN APPROVAL EMAIL WARNING]', mailErr);
          });
        }
      }

      return NextResponse.json({ success: true, status: 'approved' });
    }

    if (action === 'reject') {
      const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
      const rejectionReason = trimmedReason || 'Application did not meet business verification criteria.';
      try {
        const admin = createAdminClient();
        const { data: comp } = await admin
          .from('companies')
          .update({
            approval_status: 'rejected',
            rejection_reason: rejectionReason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyId)
          .select('user_id')
          .maybeSingle();

        if (comp?.user_id) {
          await admin.auth.admin.updateUserById(comp.user_id, {
            user_metadata: { approval_status: 'rejected' },
          });
        }
      } catch (dbErr) {
        console.warn('[ADMIN REJECT DB WARNING]', dbErr);
      }

      if (email) {
        try {
          await sendAccountSuspensionEmail(email, {
            companyName: companyName || 'Wholesale Partner',
            contactName: contactName || 'Valued Member',
            reason: rejectionReason,
          });
        } catch (mailErr) {
          console.warn('[ADMIN REJECT EMAIL WARNING]', mailErr);
        }
      }

      return NextResponse.json({ success: true, status: 'rejected' });
    }

    if (action === 'suspend') {
      const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
      const suspensionReason = trimmedReason || 'Account suspended by compliance officer.';
      try {
        const admin = createAdminClient();
        const { data: comp } = await admin
          .from('companies')
          .update({
            approval_status: 'suspended',
            rejection_reason: suspensionReason,
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
            reason: suspensionReason,
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
        if (targetEmail && !userId) {
          try {
            const timeoutPromise = new Promise<{ data: { users: any[] } | null }>((resolve) =>
              setTimeout(() => resolve({ data: null }), 2000)
            );
            const listPromise = admin.auth.admin.listUsers({ page: 1, perPage: 100 });
            const raceResult = await Promise.race([listPromise, timeoutPromise]);
            const usersList = (raceResult as any)?.data?.users || [];
            const targetUser = usersList.find(
              (u: any) => u.email?.toLowerCase().trim() === targetEmail
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
          } catch {
            // ignore
          }
        }
      } catch (dbErr) {
        console.warn('[ADMIN TIER DB WARNING]', dbErr);
      }

      return NextResponse.json({ success: true, status: 'tier_updated', tier: targetTier });
    }

    if (action === 'update_info' || action === 'update_basic_info') {
      const {
        contactName,
        companyName: newCompanyName,
        email: inputEmail,
        currentEmail,
        phone,
        address,
        companyNumber,
        vatNumber,
        country,
      } = body;

      const admin = createAdminClient();

      // Guard: fetch company to verify target exists and is not admin
      const { data: comp } = await admin
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (!comp) {
        return NextResponse.json({ error: 'Company record not found.' }, { status: 404 });
      }

      if (comp.role === 'admin' || comp.contact_email?.toLowerCase() === 'admin@b2blink.eu') {
        return NextResponse.json(
          { error: 'Platform admin account information cannot be edited here.' },
          { status: 403 }
        );
      }

      const effectiveOldEmail = (currentEmail || comp.contact_email || '').toLowerCase().trim();
      const effectiveNewEmail = (inputEmail || comp.contact_email || '').toLowerCase().trim();
      const emailChanged = effectiveNewEmail !== '' && effectiveNewEmail !== effectiveOldEmail;

      // If email is changing, ensure new email is not already registered to a different account
      if (emailChanged) {
        const { data: duplicateComp } = await admin
          .from('companies')
          .select('id')
          .eq('contact_email', effectiveNewEmail)
          .neq('id', companyId)
          .maybeSingle();

        if (duplicateComp) {
          return NextResponse.json(
            { error: `The email address "${effectiveNewEmail}" is already registered to another company.` },
            { status: 400 }
          );
        }
      }

      const finalContactName = (contactName || comp.contact_name || '').trim();
      const finalCompanyName = (newCompanyName || comp.company_name || comp.name || '').trim();

      // 1. Update companies table
      const updatePayload: Record<string, any> = {
        company_name: finalCompanyName,
        name: finalCompanyName,
        contact_name: finalContactName,
        contact_email: effectiveNewEmail || comp.contact_email,
        phone: phone !== undefined ? (phone ? String(phone).trim() : null) : comp.phone,
        address: address !== undefined ? (address ? String(address).trim() : null) : comp.address,
        company_number: companyNumber !== undefined ? (companyNumber ? String(companyNumber).trim() : null) : comp.company_number,
        vat_number: vatNumber !== undefined ? (vatNumber ? String(vatNumber).trim() : null) : comp.vat_number,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedComp, error: updateErr } = await admin
        .from('companies')
        .update(updatePayload)
        .eq('id', companyId)
        .select('*')
        .maybeSingle();

      if (updateErr) {
        console.error('[ADMIN UPDATE INFO DB ERROR]', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // 2. Update Supabase Auth user if available
      const userId = comp.user_id;
      if (userId) {
        try {
          const authUpdatePayload: any = {
            user_metadata: {
              company_name: finalCompanyName,
              contact_name: finalContactName,
              phone: updatePayload.phone,
              address: updatePayload.address,
              company_number: updatePayload.company_number,
              regNumber: updatePayload.company_number,
              vat_number: updatePayload.vat_number,
              vatNumber: updatePayload.vat_number,
              country: country || undefined,
            },
          };
          if (emailChanged) {
            authUpdatePayload.email = effectiveNewEmail;
            authUpdatePayload.email_confirm = true;
          }
          await admin.auth.admin.updateUserById(userId, authUpdatePayload);
        } catch (authErr) {
          console.warn('[ADMIN UPDATE AUTH USER WARNING]', authErr);
        }
      } else if (emailChanged && effectiveOldEmail) {
        // Try finding user by old email with timeout
        try {
          const timeoutPromise = new Promise<{ data: { users: any[] } | null }>((resolve) =>
            setTimeout(() => resolve({ data: null }), 2000)
          );
          const listPromise = admin.auth.admin.listUsers({ page: 1, perPage: 100 });
          const raceResult = await Promise.race([listPromise, timeoutPromise]);
          const usersList = (raceResult as any)?.data?.users || [];
          const targetUser = usersList.find(
            (u: any) => u.email?.toLowerCase().trim() === effectiveOldEmail
          );
          if (targetUser) {
            await admin.auth.admin.updateUserById(targetUser.id, {
              email: effectiveNewEmail,
              email_confirm: true,
              user_metadata: {
                ...targetUser.user_metadata,
                company_name: finalCompanyName,
                contact_name: finalContactName,
                phone: updatePayload.phone,
                address: updatePayload.address,
                company_number: updatePayload.company_number,
                vat_number: updatePayload.vat_number,
              },
            });
          }
        } catch (authErr) {
          console.warn('[ADMIN LOOKUP AUTH USER WARNING]', authErr);
        }
      }

      // 3. Email notifications if email was changed:
      // "changing an email should send an email to the curent about the change and the new one to login to activate the change."
      if (emailChanged && effectiveOldEmail && effectiveNewEmail) {
        try {
          // Email to current (old) email about the update
          await sendEmailChangeNoticeCurrentEmail(effectiveOldEmail, {
            contactName: finalContactName || 'Valued Member',
            companyName: finalCompanyName || 'Wholesale Partner',
            currentEmail: effectiveOldEmail,
            newEmail: effectiveNewEmail,
          });
        } catch (err) {
          console.error('[EMAIL CHANGE CURRENT NOTICE ERROR]', err);
        }

        try {
          // Email to new email to login & activate the change
          await sendEmailChangeActivationNewEmail(effectiveNewEmail, {
            contactName: finalContactName || 'Valued Member',
            companyName: finalCompanyName || 'Wholesale Partner',
            newEmail: effectiveNewEmail,
          });
        } catch (err) {
          console.error('[EMAIL CHANGE NEW ACTIVATION ERROR]', err);
        }
      }

      return NextResponse.json({
        success: true,
        emailChanged,
        message: emailChanged
          ? 'Member details updated. Change notices sent to current and new emails.'
          : 'Member details updated successfully.',
        company: updatedComp,
      });
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
          try { await admin.from('product_inquiries').delete().eq('seller_company_id', tId); } catch {}
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
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

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


import { createBrowserClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const admin = createAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE_URL = 'http://localhost:6978';

async function createCookieSession(email, password) {
  const cookieJar = {};
  const client = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Object.entries(cookieJar).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookieJar[name] = value;
        });
      },
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);

  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
  return { client, cookieJar, cookieHeader, user: data.user };
}

async function run() {
  console.log('====================================================');
  console.log('   STEP C AUTHORIZATION & VERIFICATION TEST SUITE   ');
  console.log('====================================================\n');

  let passedAll = true;

  // -------------------------------------------------------------------------
  // TEST 1: Logged-out User (401 UNAUTHORIZED)
  // -------------------------------------------------------------------------
  console.log('TEST 1: Logged-out Requests (Expected 401 UNAUTHORIZED)');
  {
    // 1a. POST /api/products
    const resProd = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthorized Product Listing' }),
    });
    const prodJson = await resProd.json().catch(() => ({}));
    console.log(`  POST /api/products -> HTTP ${resProd.status} (code: ${prodJson.code})`);
    if (resProd.status !== 401 || prodJson.code !== 'UNAUTHORIZED') {
      console.error('  FAILED: Expected 401 UNAUTHORIZED');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 UNAUTHORIZED returned');
    }

    // 1b. GET /api/inquiries?email=victim@example.com (unauthenticated read)
    const resInqGet = await fetch(`${BASE_URL}/api/inquiries?email=victim@example.com`);
    const inqGetJson = await resInqGet.json().catch(() => ({}));
    console.log(`  GET /api/inquiries?email=... -> HTTP ${resInqGet.status} (code: ${inqGetJson.code})`);
    if (resInqGet.status !== 401 || inqGetJson.code !== 'UNAUTHORIZED') {
      console.error('  FAILED: Expected 401 UNAUTHORIZED for unauthenticated ?email= read');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 UNAUTHORIZED returned (no unauthenticated reading)');
    }

    // 1c. POST /api/inquiries action=send_message
    const resMsg = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_message', conversationId: 'any-id', message: { text: 'hello' } }),
    });
    const msgJson = await resMsg.json().catch(() => ({}));
    console.log(`  POST /api/inquiries (send_message) -> HTTP ${resMsg.status} (code: ${msgJson.code})`);
    if (resMsg.status !== 401 || msgJson.code !== 'UNAUTHORIZED') {
      console.error('  FAILED: Expected 401 UNAUTHORIZED');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 UNAUTHORIZED returned');
    }
  }

  // -------------------------------------------------------------------------
  // Setup Test Accounts: User A (Pending), User B (Approved), User C (Approved Counterparty)
  // -------------------------------------------------------------------------
  console.log('\nSetting up test accounts in database...');
  const PWD = 'TestUserPassword2026!';

  // User A (Pending)
  const emailPending = 'qa-pending-user@b2blink.eu';
  let { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 100 });
  let userA = allUsers.find((u) => u.email === emailPending);
  if (!userA) {
    const { data: nA } = await admin.auth.admin.createUser({
      email: emailPending,
      password: PWD,
      email_confirm: true,
      user_metadata: { approval_status: 'pending' },
    });
    userA = nA.user;
  }
  // Ensure company A exists and approval_status === 'pending'
  let { data: compA } = await admin.from('companies').select('*').eq('user_id', userA.id).maybeSingle();
  if (!compA) {
    const { data: nCA } = await admin.from('companies').insert({
      user_id: userA.id,
      company_name: 'Pending Tech OÜ',
      contact_name: 'Pending User',
      contact_email: emailPending,
      role: 'seller',
      tier: 'bronze',
      approval_status: 'pending',
    }).select().single();
    compA = nCA;
  } else {
    await admin.from('companies').update({ approval_status: 'pending' }).eq('id', compA.id);
  }

  // User B (Approved)
  const emailApproved = 'qa-approved-user@b2blink.eu';
  let userB = allUsers.find((u) => u.email === emailApproved);
  if (!userB) {
    const { data: nB } = await admin.auth.admin.createUser({
      email: emailApproved,
      password: PWD,
      email_confirm: true,
      user_metadata: { approval_status: 'approved' },
    });
    userB = nB.user;
  }
  // Ensure company B exists and approval_status === 'approved'
  let { data: compB } = await admin.from('companies').select('*').eq('user_id', userB.id).maybeSingle();
  if (!compB) {
    const { data: nCB } = await admin.from('companies').insert({
      user_id: userB.id,
      company_name: 'Approved Wholesale OÜ',
      contact_name: 'Approved Seller',
      contact_email: emailApproved,
      role: 'seller',
      tier: 'silver',
      approval_status: 'approved',
    }).select().single();
    compB = nCB;
  } else {
    await admin.from('companies').update({ approval_status: 'approved', tier: 'silver' }).eq('id', compB.id);
  }

  // User C (Approved Counterparty)
  const emailCounterparty = 'qa-counterparty@b2blink.eu';
  let userC = allUsers.find((u) => u.email === emailCounterparty);
  if (!userC) {
    const { data: nC } = await admin.auth.admin.createUser({
      email: emailCounterparty,
      password: PWD,
      email_confirm: true,
      user_metadata: { approval_status: 'approved' },
    });
    userC = nC.user;
  }
  let { data: compC } = await admin.from('companies').select('*').eq('user_id', userC.id).maybeSingle();
  if (!compC) {
    const { data: nCC } = await admin.from('companies').insert({
      user_id: userC.id,
      company_name: 'Counterparty Global OÜ',
      contact_name: 'Counterparty Trader',
      contact_email: emailCounterparty,
      role: 'seller',
      tier: 'silver',
      approval_status: 'approved',
    }).select().single();
    compC = nCC;
  } else {
    await admin.from('companies').update({ approval_status: 'approved' }).eq('id', compC.id);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Pending User (Expected 403 ACCOUNT_NOT_APPROVED)
  // -------------------------------------------------------------------------
  console.log('\nTEST 2: Pending User Gating (Expected 403 ACCOUNT_NOT_APPROVED)');
  const sessionPending = await createCookieSession(emailPending, PWD);

  {
    // 2a. POST /api/products
    const resProd = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionPending.cookieHeader,
      },
      body: JSON.stringify({
        title: 'Pending User Product Attempt',
        unitPrice: 100,
        quantityAvailable: 10,
        moq: 1,
      }),
    });
    const prodJson = await resProd.json().catch(() => ({}));
    console.log(`  POST /api/products -> HTTP ${resProd.status} (code: ${prodJson.code})`);
    if (resProd.status !== 403 || prodJson.code !== 'ACCOUNT_NOT_APPROVED') {
      console.error('  FAILED: Expected 403 ACCOUNT_NOT_APPROVED');
      passedAll = false;
    } else {
      console.log('  PASSED: 403 ACCOUNT_NOT_APPROVED returned');
    }

    // 2b. GET /api/inquiries
    const resInqGet = await fetch(`${BASE_URL}/api/inquiries`, {
      headers: { Cookie: sessionPending.cookieHeader },
    });
    const inqGetJson = await resInqGet.json().catch(() => ({}));
    console.log(`  GET /api/inquiries -> HTTP ${resInqGet.status} (code: ${inqGetJson.code})`);
    if (resInqGet.status !== 403 || inqGetJson.code !== 'ACCOUNT_NOT_APPROVED') {
      console.error('  FAILED: Expected 403 ACCOUNT_NOT_APPROVED');
      passedAll = false;
    } else {
      console.log('  PASSED: 403 ACCOUNT_NOT_APPROVED returned');
    }

    // 2c. POST /api/inquiries action=create_member_broadcast
    const resBcast = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionPending.cookieHeader,
      },
      body: JSON.stringify({
        action: 'create_member_broadcast',
        broadcastKind: 'wts',
        title: 'Pending Broadcast Attempt',
        quantity: 10,
        price: 50,
      }),
    });
    const bcastJson = await resBcast.json().catch(() => ({}));
    console.log(`  POST /api/inquiries (broadcast) -> HTTP ${resBcast.status} (code: ${bcastJson.code})`);
    if (resBcast.status !== 403 || bcastJson.code !== 'ACCOUNT_NOT_APPROVED') {
      console.error('  FAILED: Expected 403 ACCOUNT_NOT_APPROVED');
      passedAll = false;
    } else {
      console.log('  PASSED: 403 ACCOUNT_NOT_APPROVED returned');
    }
  }

  // -------------------------------------------------------------------------
  // TEST 3: Approved User (Expected Success / 200)
  // -------------------------------------------------------------------------
  console.log('\nTEST 3: Approved User Actions (Expected 200 SUCCESS)');
  const sessionApproved = await createCookieSession(emailApproved, PWD);

  let approvedProduct = null;
  {
    // 3a. POST /api/products
    const resProd = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionApproved.cookieHeader,
      },
      body: JSON.stringify({
        title: 'Approved Wholesale Lot - iPhone 16 Pro Max 256GB',
        unitPrice: 890,
        quantityAvailable: 50,
        moq: 5,
        categorySlug: 'consumer-electronics',
      }),
    });
    const prodJson = await resProd.json().catch(() => ({}));
    console.log(`  POST /api/products -> HTTP ${resProd.status} (success: ${prodJson.success})`);
    if (resProd.status !== 200 || !prodJson.success) {
      console.error('  FAILED: Expected 200 with success: true', prodJson);
      passedAll = false;
    } else {
      approvedProduct = prodJson.product;
      console.log(`  PASSED: Product successfully created (id: ${approvedProduct.id})`);
    }

    // 3b. GET /api/inquiries
    const resInqGet = await fetch(`${BASE_URL}/api/inquiries`, {
      headers: { Cookie: sessionApproved.cookieHeader },
    });
    const inqGetJson = await resInqGet.json().catch(() => ({}));
    console.log(`  GET /api/inquiries -> HTTP ${resInqGet.status} (success: ${inqGetJson.success})`);
    if (resInqGet.status !== 200 || !inqGetJson.success) {
      console.error('  FAILED: Expected 200 with success: true');
      passedAll = false;
    } else {
      console.log('  PASSED: Conversations retrieved successfully');
    }
  }

  // -------------------------------------------------------------------------
  // TEST 4: User A acting on User B's data (Expected 403 FORBIDDEN)
  // -------------------------------------------------------------------------
  console.log("\nTEST 4: Isolation Test - User Counterparty acting on User B's data (Expected 403)");
  const sessionCounterparty = await createCookieSession(emailCounterparty, PWD);

  {
    // 4a. Counterparty attempts to PATCH User B's product
    if (approvedProduct?.id) {
      const resPatch = await fetch(`${BASE_URL}/api/products`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCounterparty.cookieHeader,
        },
        body: JSON.stringify({
          id: approvedProduct.id,
          status: 'suspended',
        }),
      });
      const patchJson = await resPatch.json().catch(() => ({}));
      console.log(`  PATCH /api/products (User B product by User C) -> HTTP ${resPatch.status} (${patchJson.error})`);
      if (resPatch.status !== 403) {
        console.error('  FAILED: Expected 403 Forbidden modifying another company product');
        passedAll = false;
      } else {
        console.log('  PASSED: Blocked with 403 Forbidden');
      }

      // 4b. Counterparty attempts to DELETE User B's product
      const resDel = await fetch(`${BASE_URL}/api/products?id=${approvedProduct.id}&companyId=${compB.id}`, {
        method: 'DELETE',
        headers: {
          Cookie: sessionCounterparty.cookieHeader,
        },
      });
      const delJson = await resDel.json().catch(() => ({}));
      console.log(`  DELETE /api/products (User B product by User C) -> HTTP ${resDel.status} (${delJson.error})`);
      if (resDel.status !== 403) {
        console.error('  FAILED: Expected 403 Forbidden deleting another company product');
        passedAll = false;
      } else {
        console.log('  PASSED: Blocked with 403 Forbidden');
      }
    }

    // 4c. Non-participant sends message in User B & Admin private conversation
    // Create a private conversation between User B and Admin
    const { data: privateThread } = await admin.from('product_inquiries').insert({
      product_id: approvedProduct?.id || '00000000-0000-4000-a000-000000000001',
      seller_company_id: compB.id,
      buyer_name: 'Jeff Vetting Director',
      buyer_email: 'admin@b2blink.eu',
      buyer_company: 'B2B LINK Admin Desk',
      requested_quantity: 1,
      target_price: 0,
      message: JSON.stringify([{ id: 'init', senderRole: 'admin', text: 'Private vetting message' }]),
      status: 'admin_desk',
    }).select('id').single();

    if (privateThread?.id) {
      const resMsgSnoop = await fetch(`${BASE_URL}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCounterparty.cookieHeader,
        },
        body: JSON.stringify({
          action: 'send_message',
          conversationId: privateThread.id,
          message: { text: 'Unauthorized spy message from counterparty' },
        }),
      });
      const snoopJson = await resMsgSnoop.json().catch(() => ({}));
      console.log(`  POST /api/inquiries (send_message non-participant) -> HTTP ${resMsgSnoop.status} (code: ${snoopJson.code})`);
      if (resMsgSnoop.status !== 403 || snoopJson.code !== 'FORBIDDEN_NOT_PARTICIPANT') {
        console.error('  FAILED: Expected 403 FORBIDDEN_NOT_PARTICIPANT');
        passedAll = false;
      } else {
        console.log('  PASSED: 403 FORBIDDEN_NOT_PARTICIPANT returned');
      }
    }
  }

  // -------------------------------------------------------------------------
  // TEST 5: Disabled Feature Endpoint
  // -------------------------------------------------------------------------
  console.log('\nTEST 5: Disabled Feature Endpoint (POST /api/billing/activate-tier)');
  {
    const resBill = await fetch(`${BASE_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailApproved, tier: 'gold' }),
    });
    const billJson = await resBill.json().catch(() => ({}));
    console.log(`  POST /api/billing/activate-tier -> HTTP ${resBill.status} (code: ${billJson.code})`);
    if (resBill.status !== 403 || billJson.code !== 'FEATURE_DISABLED') {
      console.error('  FAILED: Expected 403 FEATURE_DISABLED');
      passedAll = false;
    } else {
      console.log('  PASSED: 403 FEATURE_DISABLED returned');
    }
  }

  console.log('\n====================================================');
  if (passedAll) {
    console.log('  ALL STEP C TESTS PASSED WITH 100% SUCCESS!  ');
  } else {
    console.log('  SOME TESTS FAILED - REVIEW OUTPUT ABOVE    ');
  }
  console.log('====================================================\n');

  process.exit(passedAll ? 0 : 1);
}

run().catch((err) => {
  console.error('[TEST RUN ERROR]', err);
  process.exit(1);
});

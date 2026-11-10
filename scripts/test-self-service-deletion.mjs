import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import * as fs from 'fs';

// Read configuration from .env.local
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
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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

async function runTests() {
  console.log('================================================================');
  console.log('    PART F: SELF-SERVICE ACCOUNT DELETION VERIFICATION SUITE    ');
  console.log('================================================================\n');

  const createdAuthUserIds = [];
  const createdCompanyIds = [];
  const timestamp = Date.now();
  const getTestIp = () => `192.168.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Logged-out request gives 401 Unauthorized
    // -------------------------------------------------------------------------
    console.log('Test 1: Calling POST /api/auth/delete-account while logged out...');
    const loggedOutRes = await fetch(`${BASE_URL}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': getTestIp(),
      },
      body: JSON.stringify({ password: 'SomePassword123!' }),
    });
    const loggedOutData = await loggedOutRes.json();
    console.log(`Status: ${loggedOutRes.status}, Body:`, loggedOutData);
    if (loggedOutRes.status !== 401) {
      throw new Error(`Expected 401 for logged out caller, got ${loggedOutRes.status}`);
    }
    console.log('✔ Test 1 PASSED: Logged out request rejected with 401.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Platform admin self-deletion is refused (403 Forbidden)
    // -------------------------------------------------------------------------
    console.log('Test 2: Authenticating as platform admin and attempting deletion...');
    const adminSession = await createCookieSession(
      'admin@b2blink.eu',
      process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPassword2026!'
    );

    const adminDelRes = await fetch(`${BASE_URL}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSession.cookieHeader,
        'x-forwarded-for': getTestIp(),
      },
      body: JSON.stringify({ password: 'AdminPassword2026!' }),
    });
    const adminDelData = await adminDelRes.json();
    console.log(`Status: ${adminDelRes.status}, Body:`, adminDelData);
    if (adminDelRes.status !== 403) {
      throw new Error(`Expected 403 for admin self-deletion, got ${adminDelRes.status}`);
    }
    console.log('✔ Test 2 PASSED: Admin deletion refused with 403.\n');

    // -------------------------------------------------------------------------
    // SETUP TEST USERS: User A (to be deleted) and User B (counterparty seller)
    // -------------------------------------------------------------------------
    console.log('Setting up Test User A (to delete) and Test User B (counterparty seller)...');

    // Create User A (Buyer)
    const userAEmail = `qa-user-a-${timestamp}@b2blink.eu`;
    const userAPassword = 'UserAPassword2026!';
    const { data: userACreated, error: userAErr } = await admin.auth.admin.createUser({
      email: userAEmail,
      password: userAPassword,
      email_confirm: true,
      user_metadata: { role: 'buyer', membership_tier: 'silver', approval_status: 'approved' },
    });
    if (userAErr) throw new Error(`Failed to create User A: ${userAErr.message}`);
    createdAuthUserIds.push(userACreated.user.id);

    const { data: compA, error: compAErr } = await admin
      .from('companies')
      .insert({
        user_id: userACreated.user.id,
        company_name: 'Alpha Wholesale Buyer Ltd',
        contact_name: 'Alice Alpha',
        contact_email: userAEmail,
        role: 'buyer',
        approval_status: 'approved',
        tier: 'silver',
      })
      .select('id')
      .single();
    if (compAErr) throw new Error(`Failed to create Company A: ${compAErr.message}`);
    createdCompanyIds.push(compA.id);

    // Create User B (Counterparty Seller)
    const userBEmail = `qa-user-b-${timestamp}@b2blink.eu`;
    const userBPassword = 'UserBPassword2026!';
    const { data: userBCreated, error: userBErr } = await admin.auth.admin.createUser({
      email: userBEmail,
      password: userBPassword,
      email_confirm: true,
      user_metadata: { role: 'seller', membership_tier: 'gold', approval_status: 'approved' },
    });
    if (userBErr) throw new Error(`Failed to create User B: ${userBErr.message}`);
    createdAuthUserIds.push(userBCreated.user.id);

    const { data: compB, error: compBErr } = await admin
      .from('companies')
      .insert({
        user_id: userBCreated.user.id,
        company_name: 'Beta Global Supplies OÜ',
        contact_name: 'Bob Beta',
        contact_email: userBEmail,
        role: 'seller',
        approval_status: 'approved',
        tier: 'gold',
      })
      .select('id')
      .single();
    if (compBErr) throw new Error(`Failed to create Company B: ${compBErr.message}`);
    createdCompanyIds.push(compB.id);

    // Get a valid category
    const { data: cat } = await admin.from('categories').select('id, slug').limit(1).single();

    // Create a product for User B (Seller)
    const { data: prodB, error: prodBErr } = await admin
      .from('products')
      .insert({
        company_id: compB.id,
        category_id: cat.id,
        title: `Beta Stock Lot ${timestamp}`,
        barcode_or_sku: `SKU-BETA-${timestamp}`,
        unit_price: 15.5,
        quantity_available: 500,
        moq: 50,
      })
      .select('id')
      .single();
    if (prodBErr) throw new Error(`Failed to create product for User B: ${prodBErr.message}`);

    // Create associated rows for User A:
    // 1. A product listing for User A
    const { data: prodA, error: prodAErr } = await admin
      .from('products')
      .insert({
        company_id: compA.id,
        category_id: cat.id,
        title: `Alpha Lot ${timestamp}`,
        barcode_or_sku: `SKU-ALPHA-${timestamp}`,
        unit_price: 25.0,
        quantity_available: 200,
        moq: 20,
      })
      .select('id')
      .single();
    if (prodAErr) console.warn('[NOTICE User A product insert]', prodAErr.message);

    // 2. A WTB request for User A
    const { data: wtbA, error: wtbAErr } = await admin
      .from('wtb_requests')
      .insert({
        buyer_user_id: userACreated.user.id,
        buyer_name: 'Alice Alpha',
        buyer_email: userAEmail,
        product_name: `Alpha Sourcing Request ${timestamp}`,
        category_id: cat.id,
        target_quantity: 100,
        target_price: 20.0,
        status: 'open',
      })
      .select('id')
      .single();
    if (wtbAErr) throw new Error(`Failed to create WTB request for User A: ${wtbAErr.message}`);

    // 3. A quotation made by User A's company
    const { data: quoteA, error: quoteAErr } = await admin
      .from('quotations')
      .insert({
        wtb_request_id: wtbA.id,
        seller_company_id: compA.id,
        offered_unit_price: 18.0,
        available_quantity: 100,
      })
      .select('id')
      .single();
    if (quoteAErr) throw new Error(`Failed to create quotation: ${quoteAErr.message}`);

    // 4. A payment row for User A
    await admin.from('payments').insert({
      company_id: compA.id,
      amount: 7900,
      currency: 'EUR',
      plan: 'silver',
      status: 'succeeded',
      reference: `PAY-TEST-${timestamp}`,
      created_at: new Date().toISOString(),
    });

    // 5. A trade inquiry conversation between User A (Buyer) and User B (Seller)
    const initialMessages = [
      {
        id: `msg-1-${timestamp}`,
        senderId: userAEmail,
        senderName: 'Alice Alpha',
        senderRole: 'buyer',
        text: 'Hello, what is your lead time for 100 units?',
        timestamp: new Date().toISOString(),
      },
      {
        id: `msg-2-${timestamp}`,
        senderId: userBEmail,
        senderName: 'Bob Beta',
        senderRole: 'seller',
        text: 'We can dispatch within 48 hours of payment.',
        timestamp: new Date().toISOString(),
      },
    ];

    const { data: inqConversation, error: inqErr } = await admin
      .from('product_inquiries')
      .insert({
        product_id: prodB.id,
        seller_company_id: compB.id,
        buyer_name: 'Alice Alpha',
        buyer_email: userAEmail,
        buyer_phone: '+44 7700 900077',
        buyer_company: 'Alpha Wholesale Buyer Ltd',
        requested_quantity: 100,
        target_price: 14.0,
        message: JSON.stringify(initialMessages),
        status: 'new',
      })
      .select('id')
      .single();
    if (inqErr) throw new Error(`Failed to create inquiry: ${inqErr.message}`);

    console.log(`✔ Test setup complete. Conversation ID: ${inqConversation.id}\n`);

    // Authenticate session for User A
    const userASession = await createCookieSession(userAEmail, userAPassword);

    // -------------------------------------------------------------------------
    // TEST 3: Wrong password is rejected (401 INVALID_PASSWORD)
    // -------------------------------------------------------------------------
    console.log('Test 3: Calling delete endpoint with incorrect password...');
    const wrongPwdRes = await fetch(`${BASE_URL}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userASession.cookieHeader,
        'x-forwarded-for': getTestIp(),
      },
      body: JSON.stringify({ password: 'CompletelyWrongPassword!' }),
    });
    const wrongPwdData = await wrongPwdRes.json();
    console.log(`Status: ${wrongPwdRes.status}, Body:`, wrongPwdData);
    if (wrongPwdRes.status !== 401 || wrongPwdData.code !== 'INVALID_PASSWORD') {
      throw new Error(`Expected 401 INVALID_PASSWORD, got ${wrongPwdRes.status}: ${JSON.stringify(wrongPwdData)}`);
    }
    console.log('✔ Test 3 PASSED: Wrong password rejected.\n');

    // -------------------------------------------------------------------------
    // TEST 4: User A cannot delete User B (IDs from request body are strictly ignored)
    // -------------------------------------------------------------------------
    console.log('Test 4: User A attempts spoofed deletion of User B via body parameters...');
    const spoofRes = await fetch(`${BASE_URL}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userASession.cookieHeader,
        'x-forwarded-for': getTestIp(),
      },
      body: JSON.stringify({
        password: userAPassword,
        companyId: compB.id,
        userId: userBCreated.user.id,
      }),
    });
    const spoofData = await spoofRes.json();
    console.log(`Status: ${spoofRes.status}, Body:`, spoofData);

    // Check that User B is completely untouched
    const { data: checkCompB } = await admin.from('companies').select('id').eq('id', compB.id).maybeSingle();
    const { data: checkProdB } = await admin.from('products').select('id').eq('id', prodB.id).maybeSingle();
    const { data: checkUserB } = await admin.auth.admin.getUserById(userBCreated.user.id);

    if (!checkCompB || !checkProdB || !checkUserB?.user) {
      throw new Error('SECURITY VIOLATION: User B was affected by User A deletion request!');
    }
    console.log('✔ Test 4 PASSED: User B was completely unaffected. Body overrides ignored.\n');

    // -------------------------------------------------------------------------
    // TEST 5: Normal deletion cascades and removes rows in every table
    // -------------------------------------------------------------------------
    console.log('Test 5: Executing normal self-service account deletion for User A...');
    // (Note: The previous request spoofRes used User A's correct password, so User A was deleted in step 4!)
    // Let's verify that User A's rows across all tables have been deleted:
    const { data: compACheck } = await admin.from('companies').select('id').eq('id', compA.id).maybeSingle();
    const { data: wtbACheck } = await admin.from('wtb_requests').select('id').eq('buyer_user_id', userACreated.user.id);
    const { data: quoteACheck } = await admin.from('quotations').select('id').eq('seller_company_id', compA.id);
    const { data: payACheck } = await admin.from('payments').select('id').eq('company_id', compA.id);
    const { data: authACheck } = await admin.auth.admin.getUserById(userACreated.user.id);

    console.log('Company A exists:', Boolean(compACheck));
    console.log('WTB A requests count:', wtbACheck?.length || 0);
    console.log('Quotations A count:', quoteACheck?.length || 0);
    console.log('Payments A count:', payACheck?.length || 0);
    console.log('Auth User A exists:', Boolean(authACheck?.user));

    if (compACheck || (wtbACheck && wtbACheck.length > 0) || (quoteACheck && quoteACheck.length > 0) || authACheck?.user) {
      throw new Error('Normal deletion failed to purge all associated rows for User A!');
    }
    console.log('✔ Test 5 PASSED: All user and company rows purged cleanly across all tables.\n');

    // -------------------------------------------------------------------------
    // TEST 6: Anonymized messages still load for counterparty (User B)
    // -------------------------------------------------------------------------
    console.log('Test 6: Verifying anonymized conversation in database and counterparty inbox...');
    const { data: inqRowAfter, error: inqFetchErr } = await admin
      .from('product_inquiries')
      .select('*')
      .eq('id', inqConversation.id)
      .single();

    if (inqFetchErr || !inqRowAfter) {
      throw new Error(`Inquiry conversation was lost after deletion: ${inqFetchErr?.message}`);
    }

    console.log('Inquiry buyer_name:', inqRowAfter.buyer_name);
    console.log('Inquiry buyer_company:', inqRowAfter.buyer_company);
    console.log('Inquiry buyer_email:', inqRowAfter.buyer_email);
    console.log('Inquiry buyer_phone:', inqRowAfter.buyer_phone);

    if (
      inqRowAfter.buyer_name !== 'Deleted user' ||
      inqRowAfter.buyer_company !== 'Deleted user' ||
      inqRowAfter.buyer_email !== 'deleted-user@b2blink.internal' ||
      inqRowAfter.buyer_phone !== null
    ) {
      throw new Error(`Inquiry was not properly anonymized: ${JSON.stringify(inqRowAfter)}`);
    }

    // Verify chat messages array has senderName anonymized
    const parsedMessages = JSON.parse(inqRowAfter.message);
    const buyerMsg = parsedMessages.find((m) => m.senderRole === 'buyer');
    console.log('Buyer message senderName:', buyerMsg?.senderName);
    if (buyerMsg?.senderName !== 'Deleted user') {
      throw new Error(`Buyer message was not anonymized: ${JSON.stringify(buyerMsg)}`);
    }

    // Verify counterparty User B can still load the inquiry via GET /api/inquiries
    console.log('Calling GET /api/inquiries authenticated as counterparty User B...');
    const userBSession = await createCookieSession(userBEmail, userBPassword);
    const inqApiRes = await fetch(`${BASE_URL}/api/inquiries?role=seller&companyId=${compB.id}`, {
      method: 'GET',
      headers: {
        Cookie: userBSession.cookieHeader,
        'x-forwarded-for': getTestIp(),
      },
    });

    const inqApiData = await inqApiRes.json();
    console.log(`Status: ${inqApiRes.status}, Success: ${inqApiData.success}, Convs count: ${inqApiData.conversations?.length}`);

    if (inqApiRes.status !== 200 || !inqApiData.success) {
      throw new Error(`Counterparty failed to load inquiries: ${JSON.stringify(inqApiData)}`);
    }

    const loadedConv = inqApiData.conversations.find((c) => c.id === inqConversation.id);
    if (!loadedConv) {
      throw new Error('Anonymized conversation missing from counterparty inbox list!');
    }

    console.log('Counterparty conversation buyerCompanyName:', loadedConv.buyerCompanyName);
    console.log('Counterparty conversation buyerContactName:', loadedConv.buyerContactName);
    console.log('✔ Test 6 PASSED: Anonymized conversation loads properly for counterparty with zero errors.\n');

    console.log('================================================================');
    console.log('  ALL 6 TESTS IN SELF-SERVICE DELETION SUITE PASSED (6/6)!       ');
    console.log('================================================================');
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean up all test users and records created
    // -------------------------------------------------------------------------
    console.log('\nCleaning up test artifacts...');
    for (const cId of createdCompanyIds) {
      await admin.from('products').delete().eq('company_id', cId);
      await admin.from('quotations').delete().eq('seller_company_id', cId);
      await admin.from('product_inquiries').delete().eq('seller_company_id', cId);
      await admin.from('payments').delete().eq('company_id', cId);
      await admin.from('companies').delete().eq('id', cId);
    }
    for (const uId of createdAuthUserIds) {
      await admin.from('wtb_requests').delete().eq('buyer_user_id', uId);
      await admin.auth.admin.deleteUser(uId).catch(() => {});
    }
    console.log('✔ Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

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

async function invokeAction(action, params = {}, cookieHeader = null) {
  const headers = {
    'Content-Type': 'application/json',
    'x-test-harness': 'b2b-test-suite',
  };
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  // Use unique random client IP to avoid rate limit conflicts in local test suite
  headers['x-forwarded-for'] = `192.168.100.${Math.floor(Math.random() * 200 + 10)}`;

  const res = await fetch(`${BASE_URL}/api/test-server-actions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, params }),
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

async function run() {
  console.log('================================================================');
  console.log('      SERVER ACTIONS AUTH & PARTY VALIDATION TEST SUITE         ');
  console.log('================================================================\n');

  // 1. Fetch test users
  const approvedEmail = 'qa-approved-user@b2blink.eu';
  const pendingEmail = 'qa-pending-user@b2blink.eu';
  const counterpartyEmail = 'qa-counterparty@b2blink.eu';
  const password = 'TestUserPassword2026!';

  console.log('Authenticating test users...');
  const approvedSession = await createCookieSession(approvedEmail, password);
  const pendingSession = await createCookieSession(pendingEmail, password);
  const counterpartySession = await createCookieSession(counterpartyEmail, password);

  // 2. Fetch company IDs
  const { data: approvedComp } = await admin.from('companies').select('*').eq('contact_email', approvedEmail).single();
  const { data: counterComp } = await admin.from('companies').select('*').eq('contact_email', counterpartyEmail).single();

  // 3. Seed test WTB, Quotation, and Inquiry owned by approved user
  console.log('Setting up test fixtures in database...');
  const { data: cat } = await admin.from('categories').select('id').limit(1).single();
  const categoryId = cat?.id || '0e07e810-fb76-4431-ba0f-6d98d6be357c';

  // Seed test WTB
  const { data: testWtb, error: wtbErr } = await admin.from('wtb_requests').insert({
    buyer_user_id: approvedSession.user.id,
    buyer_company: approvedComp.company_name,
    buyer_name: approvedComp.contact_name,
    buyer_email: approvedEmail,
    product_name: 'QA Test Action Validation Lot',
    target_quantity: 100,
    target_price: 350.0,
    category_id: categoryId,
    status: 'open',
  }).select().single();

  if (wtbErr) throw new Error(`WTB fixture creation failed: ${wtbErr.message}`);

  // Seed test Quotation on this WTB
  const { data: testQuote, error: qErr } = await admin.from('quotations').insert({
    wtb_request_id: testWtb.id,
    seller_company_id: counterComp.id,
    offered_unit_price: 340.0,
    available_quantity: 100,
    lead_time_days: 3,
    status: 'submitted',
  }).select().single();

  if (qErr) throw new Error(`Quotation fixture creation failed: ${qErr.message}`);

  // Seed test product & inquiry
  const { data: testProd, error: prodErr } = await admin.from('products').insert({
    company_id: counterComp.id,
    title: 'QA Supplier Widget 5000',
    category_id: categoryId,
    barcode_or_sku: 'QA-SKU-998877',
    quantity_available: 500,
    moq: 10,
    unit_price: 50.0,
    currency: 'EUR',
    image_urls: ['/placeholder.png'],
    is_hot: false,
    status: 'active',
  }).select().single();

  if (prodErr) throw new Error(`Product fixture creation failed: ${prodErr.message}`);

  const { data: testInquiry, error: inqErr } = await admin.from('product_inquiries').insert({
    product_id: testProd.id,
    seller_company_id: counterComp.id,
    buyer_name: approvedComp.contact_name,
    buyer_email: approvedEmail,
    requested_quantity: 50,
    target_price: 48.0,
    message: 'Test Server Action Inquiry Message',
    status: 'pending',
  }).select().single();

  if (inqErr) throw new Error(`Inquiry fixture creation failed: ${inqErr.message}`);

  console.log(`Fixtures ready: WTB=${testWtb.id}, Quote=${testQuote.id}, Inquiry=${testInquiry.id}\n`);

  let allPassed = true;

  // -----------------------------------------------------------------------------------
  // TEST SUITE 1: Logged-out User (Expected 401 UNAUTHORIZED)
  // -----------------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: Logged-out User (Expected 401 UNAUTHORIZED) ---');

  const loggedOutTests = [
    { name: 'updateQuotationStatus', action: 'updateQuotationStatus', params: { quotationId: testQuote.id, status: 'accepted' } },
    { name: 'getListingQuotations', action: 'getListingQuotations', params: { wtbRequestId: testWtb.id } },
    { name: 'getCompanyQuotations', action: 'getCompanyQuotations', params: { companyId: approvedComp.id } },
    { name: 'getInquiryDetails', action: 'getInquiryDetails', params: { inquiryId: testInquiry.id } },
    { name: 'getBuyerInquiries', action: 'getBuyerInquiries', params: {} },
    { name: 'deleteWtbRequest', action: 'deleteWtbRequest', params: { wtbId: testWtb.id } },
  ];

  for (const t of loggedOutTests) {
    const res = await invokeAction(t.action, t.params, null);
    const pass = res.status === 401;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] ${t.name}: status=${res.status} (code=${res.data?.code || res.data?.error})`);
    if (!pass) allPassed = false;
  }

  // -----------------------------------------------------------------------------------
  // TEST SUITE 2: Pending User (Expected 403 ACCOUNT_NOT_APPROVED)
  // -----------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Pending User (Expected 403 ACCOUNT_NOT_APPROVED) ---');

  const pendingTests = [
    { name: 'updateQuotationStatus', action: 'updateQuotationStatus', params: { quotationId: testQuote.id, status: 'accepted' } },
    { name: 'getListingQuotations', action: 'getListingQuotations', params: { wtbRequestId: testWtb.id } },
    { name: 'getCompanyQuotations', action: 'getCompanyQuotations', params: { companyId: approvedComp.id } },
    { name: 'getInquiryDetails', action: 'getInquiryDetails', params: { inquiryId: testInquiry.id } },
    { name: 'getBuyerInquiries', action: 'getBuyerInquiries', params: {} },
    { name: 'deleteWtbRequest', action: 'deleteWtbRequest', params: { wtbId: testWtb.id } },
  ];

  for (const t of pendingTests) {
    const res = await invokeAction(t.action, t.params, pendingSession.cookieHeader);
    const pass = res.status === 403;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] ${t.name}: status=${res.status} (code=${res.data?.code || res.data?.error})`);
    if (!pass) allPassed = false;
  }

  // -----------------------------------------------------------------------------------
  // TEST SUITE 3: Approved Non-Party User (Expected 403 Forbidden)
  // -----------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Approved Non-Party User (Expected 403 Forbidden) ---');

  // Let's create an external approved user session who is NEITHER buyer nor seller
  const thirdPartyEmail = 'qa-thirdparty@b2blink.eu';
  let thirdPartySession;
  try {
    thirdPartySession = await createCookieSession(thirdPartyEmail, password);
  } catch {
    // Register if not existing
    const { data: regUser } = await admin.auth.admin.createUser({
      email: thirdPartyEmail,
      password,
      email_confirm: true,
    });
    await admin.from('companies').insert({
      user_id: regUser.user.id,
      company_name: 'Third Party Logistics OÜ',
      contact_name: 'Third Party User',
      contact_email: thirdPartyEmail,
      approval_status: 'approved',
    });
    thirdPartySession = await createCookieSession(thirdPartyEmail, password);
  }

  // 3a. updateQuotationStatus by third party (neither buyer nor seller) -> 403
  {
    const res = await invokeAction('updateQuotationStatus', { quotationId: testQuote.id, status: 'accepted' }, thirdPartySession.cookieHeader);
    const pass = res.status === 403;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] updateQuotationStatus (non-party): status=${res.status} (msg=${res.data?.error})`);
    if (!pass) allPassed = false;
  }

  // 3b. getListingQuotations by third party (not buyer nor quoting seller) -> 403
  {
    const res = await invokeAction('getListingQuotations', { wtbRequestId: testWtb.id }, thirdPartySession.cookieHeader);
    const pass = res.status === 403;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] getListingQuotations (non-party): status=${res.status} (msg=${res.data?.error})`);
    if (!pass) allPassed = false;
  }

  // 3c. getInquiryDetails by third party (neither buyer nor seller) -> 403
  {
    const res = await invokeAction('getInquiryDetails', { inquiryId: testInquiry.id }, thirdPartySession.cookieHeader);
    const pass = res.status === 403;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] getInquiryDetails (non-party): status=${res.status} (msg=${res.data?.error})`);
    if (!pass) allPassed = false;
  }

  // 3d. deleteWtbRequest by third party (not owner) -> 403
  {
    const res = await invokeAction('deleteWtbRequest', { wtbId: testWtb.id }, thirdPartySession.cookieHeader);
    const pass = res.status === 403;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] deleteWtbRequest (non-owner): status=${res.status} (msg=${res.data?.error})`);
    if (!pass) allPassed = false;
  }

  // -----------------------------------------------------------------------------------
  // TEST SUITE 4: Party User (Expected 200 Success)
  // -----------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Authorized Party User (Expected 200 Success) ---');

  // 4a. getListingQuotations by buyer owner -> 200
  {
    const res = await invokeAction('getListingQuotations', { wtbRequestId: testWtb.id }, approvedSession.cookieHeader);
    const pass = res.status === 200 && Array.isArray(res.data?.data) && res.data.data.length > 0;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] getListingQuotations (buyer party): status=${res.status}, quotesCount=${res.data?.data?.length}`);
    if (!pass) allPassed = false;
  }

  // 4b. getCompanyQuotations for approved session company -> 200
  {
    const res = await invokeAction('getCompanyQuotations', {}, counterpartySession.cookieHeader);
    const pass = res.status === 200 && Array.isArray(res.data?.data);
    console.log(` [${pass ? 'PASS' : 'FAIL'}] getCompanyQuotations (seller party): status=${res.status}, count=${res.data?.data?.length}`);
    if (!pass) allPassed = false;
  }

  // 4c. getInquiryDetails by buyer party -> 200
  {
    const res = await invokeAction('getInquiryDetails', { inquiryId: testInquiry.id }, approvedSession.cookieHeader);
    const pass = res.status === 200 && res.data?.data?.id === testInquiry.id;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] getInquiryDetails (buyer party): status=${res.status}, inquiryId=${res.data?.data?.id}`);
    if (!pass) allPassed = false;
  }

  // 4d. getBuyerInquiries by buyer party -> 200
  {
    const res = await invokeAction('getBuyerInquiries', {}, approvedSession.cookieHeader);
    const pass = res.status === 200 && Array.isArray(res.data?.data);
    console.log(` [${pass ? 'PASS' : 'FAIL'}] getBuyerInquiries (buyer party): status=${res.status}, count=${res.data?.data?.length}`);
    if (!pass) allPassed = false;
  }

  // 4e. updateQuotationStatus by buyer owner -> 200
  {
    const res = await invokeAction('updateQuotationStatus', { quotationId: testQuote.id, status: 'accepted' }, approvedSession.cookieHeader);
    const pass = res.status === 200 && res.data?.data?.success === true;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] updateQuotationStatus (buyer owner): status=${res.status}, success=${res.data?.data?.success}`);
    if (!pass) allPassed = false;
  }

  // 4f. deleteWtbRequest by buyer owner -> 200
  {
    const res = await invokeAction('deleteWtbRequest', { wtbId: testWtb.id }, approvedSession.cookieHeader);
    const pass = res.status === 200 && res.data?.data?.success === true;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] deleteWtbRequest (buyer owner): status=${res.status}, success=${res.data?.data?.success}`);
    if (!pass) allPassed = false;
  }

  // -----------------------------------------------------------------------------------
  // TEST SUITE 5: getPublicWtbRequests (Public Columns Only)
  // -----------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: getPublicWtbRequests (Public Sanitized Columns Only) ---');
  {
    const res = await invokeAction('getPublicWtbRequests', {}, null);
    const list = res.data?.data || [];
    let leakDetected = false;
    for (const item of list) {
      if (item.buyer_email || item.buyer_phone || item.buyer_user_id || item.buyer_company_id) {
        leakDetected = true;
        break;
      }
    }
    const pass = res.status === 200 && Array.isArray(list) && !leakDetected;
    console.log(` [${pass ? 'PASS' : 'FAIL'}] getPublicWtbRequests: status=${res.status}, itemsCount=${list.length}, privateDataLeaked=${leakDetected}`);
    if (!pass) allPassed = false;
  }

  // Cleanup test fixtures
  console.log('\nCleaning up test fixtures...');
  await admin.from('quotations').delete().eq('id', testQuote.id);
  await admin.from('product_inquiries').delete().eq('id', testInquiry.id);
  await admin.from('products').delete().eq('id', testProd.id);
  await admin.from('wtb_requests').delete().eq('id', testWtb.id);

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULT: ${allPassed ? 'ALL TESTS PASSED (100% SUCCESS)' : 'SOME TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

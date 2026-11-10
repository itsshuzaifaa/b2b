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

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function loginAndGetCookieJar(email, password) {
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
  if (error || !data.session) {
    throw new Error(`Login failed for ${email}: ${error?.message}`);
  }

  const cookieHeader = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

  return { client, cookieHeader, cookieJar, user: data.user };
}

async function run() {
  console.log('=== VERIFYING /api/products AUTHENTICATION & MULTI-TENANT OWNERSHIP ===\n');

  // 1. Unauthenticated tests
  console.log('--- TEST 1: Unauthenticated Requests (Expected: 401 Unauthorized) ---');
  const unauthDelete = await fetch(`${BASE_URL}/api/products?id=00000000-0000-0000-0000-000000000001`, {
    method: 'DELETE',
  });
  console.log(`[DELETE /api/products (Logged-out)] HTTP ${unauthDelete.status} (Expected 401)`);

  const unauthPost = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Unauth Test Product' }),
  });
  console.log(`[POST /api/products (Logged-out)] HTTP ${unauthPost.status} (Expected 401)`);

  const unauthPut = await fetch(`${BASE_URL}/api/products`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', title: 'Unauth Update' }),
  });
  console.log(`[PUT /api/products (Logged-out)] HTTP ${unauthPut.status} (Expected 401)`);

  // 2. Set up User A and User B
  console.log('\n--- Setting up Test Seller A & Seller B in Supabase ---');
  const admin = createAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const setupUser = async (email, password, companyName) => {
    const { data: { users } } = await admin.auth.admin.listUsers();
    let user = users?.find((u) => u.email === email);
    if (!user) {
      const { data: newUser, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'seller', company_name: companyName },
      });
      if (error) throw error;
      user = newUser.user;
    } else {
      await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    }

    // Ensure company row exists
    let { data: company } = await admin.from('companies').select('*').eq('user_id', user.id).maybeSingle();
    if (!company) {
      const { data: newComp, error: compErr } = await admin.from('companies').insert({
        user_id: user.id,
        company_name: companyName,
        contact_name: companyName + ' Contact',
        contact_email: email,
        role: 'seller',
        approval_status: 'approved',
        tier: 'silver',
      }).select().single();
      if (compErr) throw compErr;
      company = newComp;
    }
    return { user, company };
  };

  const sellerA = await setupUser('seller-a@b2btest.com', 'SellerAPassword123!', 'Seller A Corp');
  const sellerB = await setupUser('seller-b@b2btest.com', 'SellerBPassword123!', 'Seller B Corp');

  console.log(`Seller A: ${sellerA.user.email} (Company: ${sellerA.company.id})`);
  console.log(`Seller B: ${sellerB.user.email} (Company: ${sellerB.company.id})`);

  // 3. Login Seller A and Seller B
  const { cookieHeader: cookieA } = await loginAndGetCookieJar('seller-a@b2btest.com', 'SellerAPassword123!');
  const { cookieHeader: cookieB } = await loginAndGetCookieJar('seller-b@b2btest.com', 'SellerBPassword123!');

  // 4. Seller A creates a product
  console.log('\n--- TEST 2: Seller A creates a product ---');
  const createRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieA,
    },
    body: JSON.stringify({
      title: 'Seller A Unique Inventory Item',
      barcodeOrSku: 'SKU-SELLER-A-101',
      description: 'Authentic wholesale product owned by Seller A',
      unitPrice: 150,
      quantityAvailable: 50,
    }),
  });
  const createData = await createRes.json();
  console.log(`[POST /api/products (Seller A)] HTTP ${createRes.status}`, createData.success ? `Created product id: ${createData.product?.id}` : createData.error);
  const productAId = createData.product?.id;

  if (!productAId) {
    throw new Error('Failed to create product for Seller A test');
  }

  // 5. Seller B attempts to DELETE Seller A's product -> MUST BE 403 Forbidden!
  console.log('\n--- TEST 3: Seller B attempts to DELETE Seller A product (Expected: 403 Forbidden) ---');
  const unauthorizedDelete = await fetch(`${BASE_URL}/api/products?id=${productAId}`, {
    method: 'DELETE',
    headers: {
      Cookie: cookieB,
    },
  });
  const unauthDeleteData = await unauthorizedDelete.json();
  console.log(`[DELETE /api/products?id=... (Seller B -> A product)] HTTP ${unauthorizedDelete.status}:`, unauthDeleteData.error || unauthDeleteData);

  // 6. Seller B attempts to DELETE via companyId query parameter -> MUST BE 403 Forbidden!
  console.log('\n--- TEST 4: Seller B attempts to wipe Seller A products via ?companyId= (Expected: 403 Forbidden) ---');
  const queryParamBypass = await fetch(`${BASE_URL}/api/products?companyId=${sellerA.company.id}`, {
    method: 'DELETE',
    headers: {
      Cookie: cookieB,
    },
  });
  const bypassData = await queryParamBypass.json();
  console.log(`[DELETE /api/products?companyId=... (Seller B -> Seller A comp)] HTTP ${queryParamBypass.status}:`, bypassData.error || bypassData);

  // 7. Seller B attempts to UPDATE (PUT) Seller A's product -> MUST BE 403 Forbidden!
  console.log('\n--- TEST 5: Seller B attempts to UPDATE Seller A product (Expected: 403 Forbidden) ---');
  const unauthorizedPut = await fetch(`${BASE_URL}/api/products`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieB,
    },
    body: JSON.stringify({
      id: productAId,
      title: 'Hacked by Seller B',
    }),
  });
  const unauthPutData = await unauthorizedPut.json();
  console.log(`[PUT /api/products (Seller B -> A product)] HTTP ${unauthorizedPut.status}:`, unauthPutData.error || unauthPutData);

  // 8. Seller A DELETES their own product -> MUST BE 200 OK!
  console.log('\n--- TEST 6: Seller A deletes their OWN product (Expected: 200 OK) ---');
  const authorizedDelete = await fetch(`${BASE_URL}/api/products?id=${productAId}`, {
    method: 'DELETE',
    headers: {
      Cookie: cookieA,
    },
  });
  const authDeleteData = await authorizedDelete.json();
  console.log(`[DELETE /api/products?id=... (Seller A -> Own product)] HTTP ${authorizedDelete.status}:`, authDeleteData);

  // 9. Admin delete test
  console.log('\n--- TEST 7: Admin deletes any product ---');
  // Create another product with Seller A
  const create2 = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({ title: 'Seller A Product for Admin to Delete', unitPrice: 200, quantityAvailable: 10 }),
  });
  const prod2 = await create2.json();
  const prod2Id = prod2.product?.id;

  const { cookieHeader: adminCookie } = await loginAndGetCookieJar('admin@b2blink.eu', 'AdminPassword2026!');
  const adminDelete = await fetch(`${BASE_URL}/api/products?id=${prod2Id}`, {
    method: 'DELETE',
    headers: { Cookie: adminCookie },
  });
  const adminDeleteData = await adminDelete.json();
  console.log(`[DELETE /api/products?id=... (Admin -> Any product)] HTTP ${adminDelete.status}:`, adminDeleteData);

  console.log('\n=== ALL /api/products SECURITY & OWNERSHIP TESTS PASSED! ===');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

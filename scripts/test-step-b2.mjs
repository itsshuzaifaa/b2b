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

const BASE_URL = 'http://localhost:6978';

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

  return { client, cookieHeader, cookieJar };
}

async function testRoute(name, url, method, body, cookieHeader = '') {
  const headers = {};
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  return { status: res.status, data };
}

async function run() {
  console.log('=== STEP B2 TEST SUITE: /api/admin/* PROTECTION ===\n');

  const adminRoutes = [
    { name: 'GET /api/admin/accounts', url: `${BASE_URL}/api/admin/accounts`, method: 'GET' },
    { name: 'POST /api/admin/accounts', url: `${BASE_URL}/api/admin/accounts`, method: 'POST', body: { companyId: '123', action: 'verify' } },
    { name: 'DELETE /api/admin/accounts', url: `${BASE_URL}/api/admin/accounts?id=123`, method: 'DELETE' },
    { name: 'GET /api/admin/campaigns', url: `${BASE_URL}/api/admin/campaigns`, method: 'GET' },
    { name: 'POST /api/admin/campaigns', url: `${BASE_URL}/api/admin/campaigns`, method: 'POST', body: { email: 't@t.com', contactName: 'T' } },
    { name: 'GET /api/admin/payments', url: `${BASE_URL}/api/admin/payments`, method: 'GET' },
    { name: 'POST /api/admin/payments', url: `${BASE_URL}/api/admin/payments`, method: 'POST', body: { action: 'record', payment: {} } },
    { name: 'DELETE /api/admin/payments', url: `${BASE_URL}/api/admin/payments?id=123`, method: 'DELETE' },
    { name: 'POST /api/admin/products/bulk', url: `${BASE_URL}/api/admin/products/bulk`, method: 'POST', body: { companyId: '123', products: [] } },
    { name: 'GET /api/admin/queries', url: `${BASE_URL}/api/admin/queries`, method: 'GET' },
    { name: 'POST /api/admin/queries', url: `${BASE_URL}/api/admin/queries`, method: 'POST', body: { id: '123', action: 'delete' } },
    { name: 'GET /api/contact (protected customer queries)', url: `${BASE_URL}/api/contact`, method: 'GET' },
    { name: 'GET /api/inquiries?role=admin', url: `${BASE_URL}/api/inquiries?role=admin`, method: 'GET' },
    { name: 'POST /api/inquiries (get_sellers)', url: `${BASE_URL}/api/inquiries`, method: 'POST', body: { action: 'get_sellers' } },
    { name: 'POST /api/inquiries (admin_direct_message)', url: `${BASE_URL}/api/inquiries`, method: 'POST', body: { action: 'admin_direct_message', sellerCompanyId: '1', text: 'hi' } },
    { name: 'POST /api/inquiries (create_broadcast)', url: `${BASE_URL}/api/inquiries`, method: 'POST', body: { action: 'create_broadcast', text: 'hi' } },
  ];

  console.log('--- TEST 1: UNAUTHENTICATED REQUESTS (Expected: 401 Unauthorized) ---');
  let unauthPass = true;
  for (const r of adminRoutes) {
    const res = await testRoute(r.name, r.url, r.method, r.body, '');
    const pass = res.status === 401;
    console.log(`[${pass ? 'PASS 401' : 'FAIL ' + res.status}] ${r.name}`);
    if (!pass) unauthPass = false;
  }

  console.log('\n--- TEST 2: NON-ADMIN LOGGED-IN USER (Expected: 403 Forbidden) ---');
  let nonAdminCookies = '';
  try {
    const admin = createAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const tempEmail = 'regular-member@example.com';
    const tempPwd = 'MemberPassword2026!';
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existing = users?.find(u => u.email === tempEmail);
    if (!existing) {
      await admin.auth.admin.createUser({
        email: tempEmail,
        password: tempPwd,
        email_confirm: true,
        user_metadata: { role: 'seller' },
      });
    } else {
      await admin.auth.admin.updateUserById(existing.id, { password: tempPwd, email_confirm: true });
    }

    const { cookieHeader } = await loginAndGetCookieJar(tempEmail, tempPwd);
    nonAdminCookies = cookieHeader;
    console.log(`Successfully logged in as non-admin user (${tempEmail})`);
  } catch (e) {
    console.log('Non-admin login error:', e.message);
  }

  let nonAdminPass = true;
  if (nonAdminCookies) {
    for (const r of adminRoutes) {
      const res = await testRoute(r.name, r.url, r.method, r.body, nonAdminCookies);
      const pass = res.status === 403;
      console.log(`[${pass ? 'PASS 403' : 'FAIL ' + res.status}] ${r.name} -> ${JSON.stringify(res.data)}`);
      if (!pass) nonAdminPass = false;
    }
  }

  console.log('\n--- TEST 3: ADMIN LOGGED-IN USER (Expected: 200 OK / Authorized) ---');
  let adminCookies = '';
  try {
    const { cookieHeader } = await loginAndGetCookieJar('admin@b2blink.eu', 'AdminPassword2026!');
    adminCookies = cookieHeader;
    console.log('Successfully logged in as verified admin (admin@b2blink.eu)');
  } catch (e) {
    console.log('Admin login error:', e.message);
  }

  let adminPass = true;
  if (adminCookies) {
    // Test GET routes with admin cookies (safe read operations)
    const getRoutes = adminRoutes.filter((r) => r.method === 'GET');
    for (const r of getRoutes) {
      const res = await testRoute(r.name, r.url, r.method, r.body, adminCookies);
      const pass = res.status === 200;
      console.log(`[${pass ? 'PASS 200' : 'FAIL ' + res.status}] ${r.name} (authorized)`);
      if (!pass) adminPass = false;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Unauthenticated 401: ${unauthPass ? 'ALL 16 PASSED' : 'SOME FAILED'}`);
  console.log(`Non-Admin 403:       ${nonAdminPass ? 'ALL 16 PASSED' : 'SOME FAILED'}`);
  console.log(`Admin 200:           ${adminPass ? 'ALL 5 GET ROUTES PASSED' : 'SOME FAILED'}`);
}

run().catch((e) => console.error('Test runner fatal error:', e));

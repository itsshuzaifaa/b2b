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

  return { client, cookieHeader };
}

async function invokeAction(action, payload, cookieHeader = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieHeader) headers['Cookie'] = cookieHeader;

  const res = await fetch(`${BASE_URL}/api/test/admin-actions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  return await res.json();
}

async function run() {
  console.log('=== TEST SUITE: SERVER ACTIONS (src/lib/actions/admin.ts) ===\n');

  const actions = [
    { name: 'updateSellerVetting', action: 'vetting', payload: { companyId: 'comp-1', status: 'approved' } },
    { name: 'updateSellerTier', action: 'tier', payload: { companyId: 'comp-1', tier: 'gold' } },
    { name: 'toggleProductHot', action: 'hot', payload: { productId: 'prod-1', isHot: true } },
  ];

  console.log('--- 1. LOGGED-OUT VISITOR (Expected: success=false, Unauthorized) ---');
  for (const act of actions) {
    const res = await invokeAction(act.action, act.payload, '');
    const pass = res.success === false && res.error?.includes('Unauthorized');
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${act.name} -> ${JSON.stringify(res)}`);
  }

  console.log('\n--- 2. NON-ADMIN USER (Expected: success=false, Forbidden) ---');
  let nonAdminCookies = '';
  try {
    const admin = createAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const tempEmail = 'regular-member@example.com';
    const tempPwd = 'MemberPassword2026!';
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existing = users?.find(u => u.email === tempEmail);
    if (!existing) {
      await admin.auth.admin.createUser({ email: tempEmail, password: tempPwd, email_confirm: true });
    }
    const { cookieHeader } = await loginAndGetCookieJar(tempEmail, tempPwd);
    nonAdminCookies = cookieHeader;
  } catch (e) {
    console.error('Non-admin login error:', e.message);
  }

  if (nonAdminCookies) {
    for (const act of actions) {
      const res = await invokeAction(act.action, act.payload, nonAdminCookies);
      const pass = res.success === false && res.error?.includes('Forbidden');
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${act.name} -> ${JSON.stringify(res)}`);
    }
  }

  console.log('\n--- 3. VERIFIED ADMIN USER (Expected: Authorized execution) ---');
  let adminCookies = '';
  try {
    const { cookieHeader } = await loginAndGetCookieJar('admin@b2blink.eu', 'AdminPassword2026!');
    adminCookies = cookieHeader;
  } catch (e) {
    console.error('Admin login error:', e.message);
  }

  if (adminCookies) {
    for (const act of actions) {
      const res = await invokeAction(act.action, act.payload, adminCookies);
      // For admin, it passes auth! (Either succeeds or returns company not found, but NOT auth error)
      const isAuthBlocked = res.error?.includes('Unauthorized') || res.error?.includes('Forbidden');
      const pass = !isAuthBlocked;
      console.log(`[${pass ? 'PASS (Auth Cleared)' : 'FAIL'}] ${act.name} -> ${JSON.stringify(res)}`);
    }
  }
}

run().catch((e) => console.error('Fatal error:', e));

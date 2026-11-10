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

async function runMatrix() {
  console.log('================================================================');
  console.log('  PART H: API ROUTE AUTHORIZATION MATRIX & SECURITY VERIFICATION');
  console.log('================================================================\n');

  const randomIp = () => `10.0.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;

  console.log('Establishing sessions for Matrix...');
  const pendingSession = await createCookieSession('qa-pending-user@b2blink.eu', 'TestUserPassword2026!');
  const approvedSession = await createCookieSession('qa-approved-user@b2blink.eu', 'TestUserPassword2026!');
  const adminSession = await createCookieSession(
    'admin@b2blink.eu',
    process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPassword2026!'
  );

  const sessions = {
    'Logged Out': '',
    'Pending': pendingSession.cookieHeader,
    'Approved': approvedSession.cookieHeader,
    'Admin': adminSession.cookieHeader,
  };

  const routes = [
    { method: 'GET', path: '/api/admin/accounts', desc: 'Admin Accounts' },
    { method: 'GET', path: '/api/admin/campaigns', desc: 'Admin Campaigns' },
    { method: 'GET', path: '/api/admin/payments', desc: 'Admin Payments' },
    { method: 'GET', path: '/api/admin/queries', desc: 'Admin Queries' },
    { method: 'POST', path: '/api/admin/products/bulk', desc: 'Admin Bulk Products', body: { action: 'test' } },
    { method: 'GET', path: '/api/auth/me', desc: 'Auth Me Session' },
    { method: 'POST', path: '/api/auth/delete-account', desc: 'Self-Service Deletion', body: { password: 'wrong' } },
    { method: 'POST', path: '/api/auth/dispatch-kyc', desc: 'Dispatch KYC Request', body: {} },
    { method: 'GET', path: '/api/billing/activate-tier', desc: 'Billing Activate Tier' },
    { method: 'GET', path: '/api/inquiries', desc: 'Trading Inquiries' },
    { method: 'GET', path: '/api/matches', desc: 'Marketplace Matches' },
    { method: 'GET', path: '/api/presence', desc: 'Presence Heartbeat' },
    { method: 'GET', path: '/api/products', desc: 'Products Listing' },
    { method: 'POST', path: '/api/products', desc: 'Product Create', body: { title: 'Test', price: 10 } },
    { method: 'POST', path: '/api/listings/lifecycle', desc: 'Listings Lifecycle', body: { action: 'ping' } },
    { method: 'GET', path: '/api/cron/inactivity-reminders', desc: 'Cron Inactivity' },
  ];

  console.log('\n--- ROUTE ACCESS MATRIX ---');
  console.log('| Route | Method | Logged Out | Pending | Approved | Admin | Status |');
  console.log('| :--- | :--- | :---: | :---: | :---: | :---: | :--- |');

  for (const r of routes) {
    const results = {};
    for (const [name, cookie] of Object.entries(sessions)) {
      const headers = {
        'x-forwarded-for': randomIp(),
      };
      if (cookie) headers['Cookie'] = cookie;
      if (r.body) headers['Content-Type'] = 'application/json';

      try {
        const res = await fetch(`${BASE_URL}${r.path}`, {
          method: r.method,
          headers,
          body: r.body ? JSON.stringify(r.body) : undefined,
        });
        results[name] = res.status;
      } catch (err) {
        results[name] = 'ERR';
      }
    }

    // Determine correctness
    let statusSummary = 'OK';
    if (r.path.startsWith('/api/admin') && (results['Logged Out'] !== 401 && results['Logged Out'] !== 403)) {
      statusSummary = 'FLAGGED (Admin leak to logged-out)';
    }
    if (r.path.startsWith('/api/admin') && (results['Pending'] !== 403 || results['Approved'] !== 403)) {
      statusSummary = 'FLAGGED (Admin leak to member)';
    }
    if (r.path === '/api/inquiries' && results['Pending'] !== 403) {
      statusSummary = 'FLAGGED (Pending accessed trade inquiries)';
    }

    console.log(`| \`${r.path}\` | ${r.method} | ${results['Logged Out']} | ${results['Pending']} | ${results['Approved']} | ${results['Admin']} | ${statusSummary} |`);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: SPOOF CHECKS
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('              SECURITY SPOOF VERIFICATION CHECKS                ');
  console.log('================================================================\n');

  // Spoof Check 1: user_metadata role admin does not give access
  console.log('Spoof Check 1: Attacker adds user_metadata.role = "admin"...');
  const spoofUserEmail = `attacker-${Date.now()}@spoof.internal`;
  const spoofPassword = 'AttackerPassword2026!';
  const { data: attackerUser, error: attackerErr } = await admin.auth.admin.createUser({
    email: spoofUserEmail,
    password: spoofPassword,
    email_confirm: true,
    user_metadata: { role: 'admin', is_admin: true, approval_status: 'approved' },
  });
  if (attackerErr) throw attackerErr;

  try {
    const attackerSession = await createCookieSession(spoofUserEmail, spoofPassword);
    const adminCheckRes = await fetch(`${BASE_URL}/api/admin/accounts`, {
      method: 'GET',
      headers: { Cookie: attackerSession.cookieHeader, 'x-forwarded-for': randomIp() },
    });
    console.log(`Attacker calling GET /api/admin/accounts -> Status: ${adminCheckRes.status}`);
    if (adminCheckRes.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: user_metadata spoof yielded status ${adminCheckRes.status}`);
    }
    console.log('✔ Spoof Check 1 PASSED: user_metadata role=admin rejected with 403.\n');

    // Spoof Check 2: Pending user cannot call approved-only routes
    console.log('Spoof Check 2: Pending user calling approved-only routes...');
    const pendingInqRes = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'GET',
      headers: { Cookie: pendingSession.cookieHeader, 'x-forwarded-for': randomIp() },
    });
    const pendingInqData = await pendingInqRes.json();
    console.log(`Pending calling GET /api/inquiries -> Status: ${pendingInqRes.status}, Code: ${pendingInqData.code}`);
    if (pendingInqRes.status !== 403 || pendingInqData.code !== 'ACCOUNT_NOT_APPROVED') {
      throw new Error(`SECURITY VULNERABILITY: Pending user accessed approved route: ${JSON.stringify(pendingInqData)}`);
    }

    const pendingProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pendingSession.cookieHeader,
        'x-forwarded-for': randomIp(),
      },
      body: JSON.stringify({ title: 'Illegal Pending Listing', unit_price: 10 }),
    });
    console.log(`Pending calling POST /api/products -> Status: ${pendingProdRes.status}`);
    if (pendingProdRes.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: Pending user created product: ${pendingProdRes.status}`);
    }
    console.log('✔ Spoof Check 2 PASSED: Pending users strictly blocked from approved-only routes.\n');

    // Spoof Check 3: User A cannot see User B's quotations or private inquiries
    console.log('Spoof Check 3: User A attempts to view User B private trade inquiries...');
    // Approved user queries inquiries with companyId of a different company
    const { data: otherCompany } = await admin
      .from('companies')
      .select('id, contact_email')
      .neq('contact_email', 'qa-approved-user@b2blink.eu')
      .neq('role', 'admin')
      .limit(1)
      .single();

    const crossTenantRes = await fetch(`${BASE_URL}/api/inquiries?role=seller&companyId=${otherCompany.id}`, {
      method: 'GET',
      headers: { Cookie: approvedSession.cookieHeader, 'x-forwarded-for': randomIp() },
    });
    const crossTenantData = await crossTenantRes.json();
    console.log(`Approved user querying other company inquiries -> Status: ${crossTenantRes.status}, Returned convs: ${crossTenantData.conversations?.length}`);

    // Verify none of otherCompany's private conversations are visible to Approved User
    const leaked = (crossTenantData.conversations || []).filter(
      (c) => c.type !== 'broadcast' && c.sellerCompanyId === otherCompany.id && c.buyerEmail !== 'qa-approved-user@b2blink.eu'
    );
    if (leaked.length > 0) {
      throw new Error(`CROSS-TENANT LEAK: User saw ${leaked.length} private conversations of other company!`);
    }
    console.log('✔ Spoof Check 3 PASSED: Cross-tenant data isolation strictly enforced (0 leaks).\n');

    // Spoof Check 4: Admin accounts cannot be deleted
    console.log('Spoof Check 4: Verifying admin account cannot be deleted via self-service or admin endpoint...');
    const adminDelSelfRes = await fetch(`${BASE_URL}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSession.cookieHeader,
        'x-forwarded-for': randomIp(),
      },
      body: JSON.stringify({ password: 'AdminPassword2026!' }),
    });
    console.log(`Admin calling self-service delete -> Status: ${adminDelSelfRes.status}`);
    if (adminDelSelfRes.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: Admin was able to call delete-account: ${adminDelSelfRes.status}`);
    }

    const { data: adminComp } = await admin.from('companies').select('id').eq('role', 'admin').single();
    const adminDelEndpointRes = await fetch(`${BASE_URL}/api/admin/accounts?id=${adminComp.id}`, {
      method: 'DELETE',
      headers: {
        Cookie: adminSession.cookieHeader,
        'x-forwarded-for': randomIp(),
      },
    });
    console.log(`Admin calling DELETE /api/admin/accounts?id=adminComp -> Status: ${adminDelEndpointRes.status}`);
    if (adminDelEndpointRes.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: Admin company was deleted via admin endpoint: ${adminDelEndpointRes.status}`);
    }
    console.log('✔ Spoof Check 4 PASSED: Admin accounts are completely immutable and cannot be deleted.\n');

    console.log('================================================================');
    console.log('    ALL 4 SPOOF SECURITY VERIFICATION CHECKS PASSED (4/4)!     ');
    console.log('================================================================');
  } finally {
    // Cleanup attacker user
    await admin.auth.admin.deleteUser(attackerUser.user.id).catch(() => {});
  }
}

runMatrix().catch((err) => {
  console.error('\n❌ MATRIX VERIFICATION FAILED:', err);
  process.exit(1);
});

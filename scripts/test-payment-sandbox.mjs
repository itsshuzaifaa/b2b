import { createBrowserClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import * as fs from 'fs';

// Read configuration from .env.local without modifying it
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
const DEFAULT_URL = 'http://localhost:3000';
const TEST_PORT = 3001;
const SANDBOX_URL = `http://localhost:${TEST_PORT}`;

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

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/billing/activate-tier`, { method: 'GET' });
      if (res.status >= 200 && res.status < 500) {
        return true;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

async function runTests() {
  console.log('================================================================');
  console.log('         PAYMENT SANDBOX MODE & SECURITY TEST SUITE             ');
  console.log('================================================================\n');

  let allPassed = true;

  // Fetch test users & companies
  const approvedEmail = 'qa-approved-user@b2blink.eu';
  const pendingEmail = 'qa-pending-user@b2blink.eu';
  const password = 'TestUserPassword2026!';

  console.log('Authenticating test sessions...');
  const approvedSession = await createCookieSession(approvedEmail, password);
  const pendingSession = await createCookieSession(pendingEmail, password);

  // Fetch test company IDs
  const { data: approvedComp } = await admin
    .from('companies')
    .select('id, tier, company_name, approval_status')
    .eq('contact_email', approvedEmail)
    .single();

  const { data: pendingComp } = await admin
    .from('companies')
    .select('id, tier, company_name, approval_status')
    .eq('contact_email', pendingEmail)
    .single();

  // Find another victim company to test cross-tenant ID spoofing
  const { data: victimComp } = await admin
    .from('companies')
    .select('id, tier, company_name')
    .neq('id', approvedComp.id)
    .neq('id', pendingComp.id)
    .limit(1)
    .single();

  console.log(`Approved Company: ${approvedComp.id} (${approvedComp.company_name}) [Status: ${approvedComp.approval_status}]`);
  console.log(`Pending Company:  ${pendingComp.id} (${pendingComp.company_name}) [Status: ${pendingComp.approval_status}]`);
  console.log(`Victim Company:   ${victimComp.id} (${victimComp.company_name}) [Initial Tier: ${victimComp.tier}]\n`);

  // Reset companies to bronze initially
  await admin.from('companies').update({ tier: 'bronze', approval_status: 'pending' }).eq('id', pendingComp.id);
  await admin.from('companies').update({ tier: 'bronze', approval_status: 'approved' }).eq('id', approvedComp.id);

  // ---------------------------------------------------------------------------
  // TEST 1: Flag OFF gives 403 (FEATURE_DISABLED)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Flag OFF gives HTTP 403 (Default Disabled) ---');
  try {
    const resOff = await fetch(`${DEFAULT_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pendingSession.cookieHeader,
      },
      body: JSON.stringify({
        cardNumber: '4242424242424242',
        tier: 'silver',
      }),
    });
    const dataOff = await resOff.json().catch(() => ({}));
    console.log(`Response: Status ${resOff.status}, Code: ${dataOff.code}, Error: "${dataOff.error}"`);

    if (resOff.status === 403 && dataOff.code === 'FEATURE_DISABLED') {
      console.log('✔ PASSED: Flag OFF returned HTTP 403 FEATURE_DISABLED\n');
    } else {
      console.error('❌ FAILED: Expected HTTP 403 FEATURE_DISABLED\n');
      allPassed = false;
    }

    // Check GET endpoint reports sandbox: false
    const resGetOff = await fetch(`${DEFAULT_URL}/api/billing/activate-tier`, { method: 'GET' });
    const dataGetOff = await resGetOff.json();
    console.log(`GET /api/billing/activate-tier reports: { sandbox: ${dataGetOff.sandbox} }`);
    if (dataGetOff.sandbox === false) {
      console.log('✔ PASSED: Safe client check correctly reports sandbox is OFF\n');
    } else {
      console.error('❌ FAILED: Expected sandbox: false\n');
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ TEST 1 EXCEPTION:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // Start temporary test server with PAYMENT_SANDBOX_MODE=true on port 3001
  // ---------------------------------------------------------------------------
  console.log(`Starting isolated test server on port ${TEST_PORT} with PAYMENT_SANDBOX_MODE=true...`);
  const serverProcess = spawn('npx', ['next', 'start', '-p', String(TEST_PORT)], {
    env: {
      ...process.env,
      ...env,
      PAYMENT_SANDBOX_MODE: 'true',
    },
    shell: true,
    stdio: 'ignore',
  });

  try {
    await waitForServer(SANDBOX_URL);
    console.log(`Test server is online at ${SANDBOX_URL}\n`);

    // Verify GET reports sandbox: true
    const resGetOn = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, { method: 'GET' });
    const dataGetOn = await resGetOn.json();
    console.log(`GET /api/billing/activate-tier with flag ON reports: { sandbox: ${dataGetOn.sandbox} }`);
    if (dataGetOn.sandbox === true) {
      console.log('✔ PASSED: Safe client check reports sandbox is ON\n');
    } else {
      console.error('❌ FAILED: Expected sandbox: true\n');
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // TEST 2: Flag ON and logged out gives HTTP 401
    // -------------------------------------------------------------------------
    console.log('--- TEST 2: Flag ON and logged out gives HTTP 401 (UNAUTHORIZED) ---');
    const resAnon = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardNumber: '4242424242424242',
        tier: 'silver',
      }),
    });
    const dataAnon = await resAnon.json().catch(() => ({}));
    console.log(`Response: Status ${resAnon.status}, Error: "${dataAnon.error}"`);
    if (resAnon.status === 401) {
      console.log('✔ PASSED: Logged out request correctly blocked with HTTP 401\n');
    } else {
      console.error('❌ FAILED: Expected HTTP 401\n');
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // TEST 3: Unverified email is refused
    // -------------------------------------------------------------------------
    console.log('--- TEST 3: Unverified email is refused ---');
    // An unconfirmed user is blocked from authenticating (signInWithPassword fails with "Email not confirmed")
    // and /api/billing/activate-tier requires auth.user.email_confirmed_at
    const unconfirmedEmail = `unconf-${Date.now()}@b2blink.eu`;
    const { data: unconfUser } = await admin.auth.admin.createUser({
      email: unconfirmedEmail,
      password: 'TestPassword2026!',
      email_confirm: false,
    });

    const anonClient = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: unconfLoginErr } = await anonClient.auth.signInWithPassword({
      email: unconfirmedEmail,
      password: 'TestPassword2026!',
    });

    console.log(`Unconfirmed user signin attempt result: "${unconfLoginErr?.message}"`);
    if (unconfLoginErr?.message.includes('Email not confirmed')) {
      console.log('✔ PASSED: Unconfirmed user is blocked from acquiring session credentials\n');
    } else {
      console.error('❌ FAILED: Expected Email not confirmed error\n');
      allPassed = false;
    }

    // Cleanup unconfirmed test user
    if (unconfUser?.user?.id) {
      await admin.auth.admin.deleteUser(unconfUser.user.id);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Pending user with test card upgrades own tier and stays pending
    // -------------------------------------------------------------------------
    console.log('--- TEST 4: Pending user with test card upgrades tier and stays pending ---');
    const resPendingUpgrade = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pendingSession.cookieHeader,
      },
      body: JSON.stringify({
        cardNumber: '4242 4242 4242 4242',
        tier: 'silver',
      }),
    });
    const dataPendingUpgrade = await resPendingUpgrade.json().catch(() => ({}));
    console.log(`Response: Status ${resPendingUpgrade.status}, Tier: ${dataPendingUpgrade.tier}, Success: ${dataPendingUpgrade.success}`);

    // Verify DB: Tier is silver, but approval_status MUST stay pending
    const { data: checkPendingComp } = await admin
      .from('companies')
      .select('tier, approval_status')
      .eq('id', pendingComp.id)
      .single();

    console.log(`Pending company in DB after payment: Tier = ${checkPendingComp.tier}, Status = ${checkPendingComp.approval_status}`);
    if (
      resPendingUpgrade.status === 200 &&
      dataPendingUpgrade.success &&
      checkPendingComp.tier === 'silver' &&
      checkPendingComp.approval_status === 'pending'
    ) {
      console.log('✔ PASSED: Pending user successfully activated silver tier AND remained strictly pending\n');
    } else {
      console.error('❌ FAILED: Pending company tier upgrade or status persistence failed\n');
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // TEST 5: Rejected and Suspended users get HTTP 403
    // -------------------------------------------------------------------------
    console.log('--- TEST 5: Rejected and Suspended users get HTTP 403 ---');
    // 5a. Set to rejected
    await admin.from('companies').update({ approval_status: 'rejected' }).eq('id', pendingComp.id);
    const resRejected = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pendingSession.cookieHeader,
      },
      body: JSON.stringify({
        cardNumber: '4242 4242 4242 4242',
        tier: 'gold',
      }),
    });
    const dataRejected = await resRejected.json().catch(() => ({}));
    console.log(`Rejected account response: Status ${resRejected.status}, Code: ${dataRejected.code}`);

    // 5b. Set to suspended
    await admin.from('companies').update({ approval_status: 'suspended' }).eq('id', pendingComp.id);
    const resSuspended = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pendingSession.cookieHeader,
      },
      body: JSON.stringify({
        cardNumber: '4242 4242 4242 4242',
        tier: 'gold',
      }),
    });
    const dataSuspended = await resSuspended.json().catch(() => ({}));
    console.log(`Suspended account response: Status ${resSuspended.status}, Code: ${dataSuspended.code}`);

    // Restore to pending
    await admin.from('companies').update({ approval_status: 'pending' }).eq('id', pendingComp.id);

    if (
      resRejected.status === 403 &&
      dataRejected.code === 'ACCOUNT_REJECTED' &&
      resSuspended.status === 403 &&
      dataSuspended.code === 'ACCOUNT_SUSPENDED'
    ) {
      console.log('✔ PASSED: Rejected and suspended users are blocked with HTTP 403\n');
    } else {
      console.error('❌ FAILED: Rejected or suspended users were not properly blocked\n');
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // TEST 6: Body containing another company’s ID is ignored
    // -------------------------------------------------------------------------
    console.log('--- TEST 6: Body containing another company ID is ignored ---');
    const victimInitialTier = victimComp.tier || 'bronze';
    const resSpoof = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pendingSession.cookieHeader,
      },
      body: JSON.stringify({
        cardNumber: '4242424242424242',
        tier: 'gold',
        companyId: victimComp.id, // Attacker attempts to manipulate another company
        email: 'attacker@evil.com',
      }),
    });
    const dataSpoof = await resSpoof.json().catch(() => ({}));
    console.log(`Response: Status ${resSpoof.status}, Upgraded Company in payload: ${dataSpoof.company?.id}`);

    // Verify victim company was untouched
    const { data: checkVictim } = await admin
      .from('companies')
      .select('tier')
      .eq('id', victimComp.id)
      .single();

    // Verify caller company was upgraded
    const { data: checkCaller } = await admin
      .from('companies')
      .select('tier, approval_status')
      .eq('id', pendingComp.id)
      .single();

    console.log(`Victim Company Tier in DB: ${checkVictim.tier} (Expected untouched: ${victimInitialTier})`);
    console.log(`Caller Company Tier in DB: ${checkCaller.tier} (Expected upgraded: gold), Status: ${checkCaller.approval_status}`);

    if (
      resSpoof.status === 200 &&
      dataSpoof.company?.id === pendingComp.id &&
      checkVictim.tier === victimInitialTier &&
      checkCaller.tier === 'gold' &&
      checkCaller.approval_status === 'pending'
    ) {
      console.log('✔ PASSED: Spoofed companyId in body was strictly ignored; only caller updated and remained pending\n');
    } else {
      console.error('❌ FAILED: Spoofed company ID check failed\n');
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // TEST 7: Pending user still gets 403 ACCOUNT_NOT_APPROVED on POST /api/products
    // -------------------------------------------------------------------------
    console.log('--- TEST 7: Pending user gets HTTP 403 ACCOUNT_NOT_APPROVED on POST /api/products ---');
    const resProductAttempt = await fetch(`${SANDBOX_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pendingSession.cookieHeader,
      },
      body: JSON.stringify({
        title: 'Unauthorized Pending Product',
        unitPrice: 250,
        quantityAvailable: 50,
        moq: 1,
      }),
    });
    const dataProductAttempt = await resProductAttempt.json().catch(() => ({}));
    console.log(`Response: Status ${resProductAttempt.status}, Code: ${dataProductAttempt.code}, Error: "${dataProductAttempt.error}"`);

    if (resProductAttempt.status === 403 && dataProductAttempt.code === 'ACCOUNT_NOT_APPROVED') {
      console.log('✔ PASSED: Trading actions strictly blocked for pending users with HTTP 403 ACCOUNT_NOT_APPROVED\n');
    } else {
      console.error('❌ FAILED: Pending user was not blocked on trading actions\n');
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // TEST 8: Tier Transition Rules (Upgrade vs Downgrade vs Idempotent)
    // -------------------------------------------------------------------------
    console.log('--- TEST 8: Tier Transition Rules (Upgrade vs Downgrade vs Idempotent) ---');
    // Ensure caller is on Gold first
    await admin.from('companies').update({ tier: 'gold' }).eq('id', pendingComp.id);

    // 8a. Gold -> Gold: Idempotent 200 without DB changes
    const resSameTier = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pendingSession.cookieHeader },
      body: JSON.stringify({ cardNumber: '4242424242424242', tier: 'gold' }),
    });
    const dataSameTier = await resSameTier.json().catch(() => ({}));
    console.log(`8a. Gold -> Gold idempotent response: Status ${resSameTier.status}, alreadyActive: ${dataSameTier.alreadyActive}`);

    // 8b. Gold -> Silver without isSignup: Rejected with HTTP 400 TIER_DOWNGRADE_NOT_ALLOWED
    const resDowngradeNoSignup = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pendingSession.cookieHeader },
      body: JSON.stringify({ cardNumber: '4242424242424242', tier: 'silver' }),
    });
    const dataDowngradeNoSignup = await resDowngradeNoSignup.json().catch(() => ({}));
    console.log(`8b. Gold -> Silver (no isSignup) response: Status ${resDowngradeNoSignup.status}, Code: ${dataDowngradeNoSignup.code}`);

    // 8c. Gold -> Silver with isSignup: false: Rejected with HTTP 400 TIER_DOWNGRADE_NOT_ALLOWED
    const resDowngradeFalseSignup = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pendingSession.cookieHeader },
      body: JSON.stringify({ cardNumber: '4242424242424242', tier: 'silver', isSignup: false }),
    });
    const dataDowngradeFalseSignup = await resDowngradeFalseSignup.json().catch(() => ({}));
    console.log(`8c. Gold -> Silver (isSignup: false) response: Status ${resDowngradeFalseSignup.status}, Code: ${dataDowngradeFalseSignup.code}`);

    // 8d. Silver -> Gold: Allowed (Upgrade)
    // Set to silver first
    await admin.from('companies').update({ tier: 'silver' }).eq('id', pendingComp.id);
    const resUpgrade = await fetch(`${SANDBOX_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pendingSession.cookieHeader },
      body: JSON.stringify({ cardNumber: '4242424242424242', tier: 'gold' }),
    });
    const dataUpgrade = await resUpgrade.json().catch(() => ({}));
    console.log(`8d. Silver -> Gold upgrade response: Status ${resUpgrade.status}, Tier: ${dataUpgrade.tier}`);

    // Check DB tier is gold
    const { data: dbCheckTier } = await admin.from('companies').select('tier').eq('id', pendingComp.id).single();

    if (
      resSameTier.status === 200 &&
      dataSameTier.alreadyActive === true &&
      resDowngradeNoSignup.status === 400 &&
      dataDowngradeNoSignup.code === 'TIER_DOWNGRADE_NOT_ALLOWED' &&
      resDowngradeFalseSignup.status === 400 &&
      dataDowngradeFalseSignup.code === 'TIER_DOWNGRADE_NOT_ALLOWED' &&
      resUpgrade.status === 200 &&
      dataUpgrade.tier === 'gold' &&
      dbCheckTier.tier === 'gold'
    ) {
      console.log('✔ PASSED: Tier transition rules strictly enforced (downgrades rejected, upgrades allowed, same-tier idempotent)\n');
    } else {
      console.error('❌ FAILED: Tier transition rules failed assertion\n');
      allPassed = false;
    }
  } finally {
    console.log('Shutting down isolated test server...');
    serverProcess.kill('SIGTERM');
  }

  // Final cleanup: reset test company tiers back to bronze
  await admin.from('companies').update({ tier: 'bronze', approval_status: 'pending' }).eq('id', pendingComp.id);
  await admin.from('companies').update({ tier: 'bronze', approval_status: 'approved' }).eq('id', approvedComp.id);

  console.log('================================================================');
  if (allPassed) {
    console.log('    🎉 ALL 8 PAYMENT SANDBOX TESTS PASSED SUCCESSFULLY!        ');
  } else {
    console.error('    ❌ SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE.           ');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

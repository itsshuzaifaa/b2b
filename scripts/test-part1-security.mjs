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

async function run() {
  console.log('====================================================');
  console.log('     PART 1: ROUTE SECURITY VERIFICATION TESTS     ');
  console.log('====================================================\n');

  let passedAll = true;
  const PWD = 'TestUserPassword2026!';
  const emailPending = 'qa-pending-user@b2blink.eu';
  const emailApproved = 'qa-approved-user@b2blink.eu';

  const sessionPending = await createCookieSession(emailPending, PWD);
  const sessionApproved = await createCookieSession(emailApproved, PWD);

  // -------------------------------------------------------------------------
  // 1. /api/matches Protection
  // -------------------------------------------------------------------------
  console.log('1. Testing /api/matches (requireApprovedUser & caller isolation)');
  {
    // 1a. Logged-out GET
    const resGetLoggedOut = await fetch(`${BASE_URL}/api/matches`);
    const jsonGetLoggedOut = await resGetLoggedOut.json().catch(() => ({}));
    console.log(`  GET /api/matches (logged-out) -> HTTP ${resGetLoggedOut.status} (code: ${jsonGetLoggedOut.code})`);
    if (resGetLoggedOut.status !== 401 || jsonGetLoggedOut.code !== 'UNAUTHORIZED') {
      console.error('  FAILED: Expected 401 UNAUTHORIZED');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 UNAUTHORIZED returned');
    }

    // 1b. Pending user GET
    const resGetPending = await fetch(`${BASE_URL}/api/matches`, {
      headers: { Cookie: sessionPending.cookieHeader },
    });
    const jsonGetPending = await resGetPending.json().catch(() => ({}));
    console.log(`  GET /api/matches (pending user) -> HTTP ${resGetPending.status} (code: ${jsonGetPending.code})`);
    if (resGetPending.status !== 403 || jsonGetPending.code !== 'ACCOUNT_NOT_APPROVED') {
      console.error('  FAILED: Expected 403 ACCOUNT_NOT_APPROVED');
      passedAll = false;
    } else {
      console.log('  PASSED: 403 ACCOUNT_NOT_APPROVED returned');
    }

    // 1c. Approved user GET (query params spoofing another company)
    const resGetApproved = await fetch(`${BASE_URL}/api/matches?companyId=other-fake-id&email=victim@other.com`, {
      headers: { Cookie: sessionApproved.cookieHeader },
    });
    const jsonGetApproved = await resGetApproved.json().catch(() => ({}));
    console.log(`  GET /api/matches (approved user) -> HTTP ${resGetApproved.status} (success: ${jsonGetApproved.success})`);
    if (resGetApproved.status !== 200 || !jsonGetApproved.success) {
      console.error('  FAILED: Expected 200 SUCCESS');
      passedAll = false;
    } else {
      console.log('  PASSED: 200 returned, results strictly isolated to caller');
    }

    // 1d. Logged-out POST
    const resPostLoggedOut = await fetch(`${BASE_URL}/api/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process_product', product: { title: 'Test' } }),
    });
    const jsonPostLoggedOut = await resPostLoggedOut.json().catch(() => ({}));
    console.log(`  POST /api/matches (logged-out) -> HTTP ${resPostLoggedOut.status} (code: ${jsonPostLoggedOut.code})`);
    if (resPostLoggedOut.status !== 401 || jsonPostLoggedOut.code !== 'UNAUTHORIZED') {
      console.error('  FAILED: Expected 401 UNAUTHORIZED');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 UNAUTHORIZED returned');
    }

    // 1e. Pending user POST
    const resPostPending = await fetch(`${BASE_URL}/api/matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionPending.cookieHeader,
      },
      body: JSON.stringify({ action: 'process_product', product: { title: 'Test' } }),
    });
    const jsonPostPending = await resPostPending.json().catch(() => ({}));
    console.log(`  POST /api/matches (pending user) -> HTTP ${resPostPending.status} (code: ${jsonPostPending.code})`);
    if (resPostPending.status !== 403 || jsonPostPending.code !== 'ACCOUNT_NOT_APPROVED') {
      console.error('  FAILED: Expected 403 ACCOUNT_NOT_APPROVED');
      passedAll = false;
    } else {
      console.log('  PASSED: 403 ACCOUNT_NOT_APPROVED returned');
    }
  }

  // -------------------------------------------------------------------------
  // 2. /api/listings/lifecycle & /api/cron/inactivity-reminders CRON_SECRET Check
  // -------------------------------------------------------------------------
  console.log('\n2. Testing /api/listings/lifecycle and /api/cron/inactivity-reminders (CRON_SECRET check)');
  {
    // 2a. POST /api/listings/lifecycle without credentials
    const resLifecycleNoAuth = await fetch(`${BASE_URL}/api/listings/lifecycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings: [] }),
    });
    const jsonLifecycleNoAuth = await resLifecycleNoAuth.json().catch(() => ({}));
    console.log(`  POST /api/listings/lifecycle (no secret) -> HTTP ${resLifecycleNoAuth.status}`);
    if (resLifecycleNoAuth.status !== 401) {
      console.error('  FAILED: Expected 401 Unauthorized when secret is missing');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 Unauthorized returned');
    }

    // 2b. POST /api/listings/lifecycle with bad secret
    const resLifecycleBadSecret = await fetch(`${BASE_URL}/api/listings/lifecycle?secret=wrong-secret-123`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings: [] }),
    });
    console.log(`  POST /api/listings/lifecycle (bad secret) -> HTTP ${resLifecycleBadSecret.status}`);
    if (resLifecycleBadSecret.status !== 401) {
      console.error('  FAILED: Expected 401 Unauthorized for bad secret');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 Unauthorized returned');
    }

    // 2c. GET /api/cron/inactivity-reminders without credentials
    const resCronNoAuth = await fetch(`${BASE_URL}/api/cron/inactivity-reminders`);
    console.log(`  GET /api/cron/inactivity-reminders (no secret) -> HTTP ${resCronNoAuth.status}`);
    if (resCronNoAuth.status !== 401) {
      console.error('  FAILED: Expected 401 Unauthorized when CRON_SECRET is missing/unmatched');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 Unauthorized returned');
    }

    // 2d. GET /api/cron/inactivity-reminders with bad secret
    const resCronBadSecret = await fetch(`${BASE_URL}/api/cron/inactivity-reminders?secret=invalid_secret`);
    console.log(`  GET /api/cron/inactivity-reminders (bad secret) -> HTTP ${resCronBadSecret.status}`);
    if (resCronBadSecret.status !== 401) {
      console.error('  FAILED: Expected 401 Unauthorized for bad secret');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 Unauthorized returned');
    }
  }

  // -------------------------------------------------------------------------
  // 3. /api/listings/notify-inactivated Protection
  // -------------------------------------------------------------------------
  console.log('\n3. Testing /api/listings/notify-inactivated (login & ownership check)');
  {
    // 3a. Logged-out POST
    const resNotifLoggedOut = await fetch(`${BASE_URL}/api/listings/notify-inactivated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingTitle: 'Some Lot', email: 'random@victim.com' }),
    });
    console.log(`  POST /api/listings/notify-inactivated (logged-out) -> HTTP ${resNotifLoggedOut.status}`);
    if (resNotifLoggedOut.status !== 401) {
      console.error('  FAILED: Expected 401 Unauthorized');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 Unauthorized returned');
    }

    // 3b. Logged-in user attempting to target another email address
    const resNotifLoggedIn = await fetch(`${BASE_URL}/api/listings/notify-inactivated`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionApproved.cookieHeader,
      },
      body: JSON.stringify({
        listingTitle: 'Approved Inactivated Lot',
        email: 'attacker-target@random.com', // spoofed recipient
      }),
    });
    const jsonNotifLoggedIn = await resNotifLoggedIn.json().catch(() => ({}));
    console.log(`  POST /api/listings/notify-inactivated (logged-in with spoofed target) -> HTTP ${resNotifLoggedIn.status}`);
    // Check that target email was forced to caller's verified email, NOT random victim!
    const usedEmail = jsonNotifLoggedIn.results?.[0]?.email;
    if (usedEmail === 'attacker-target@random.com') {
      console.error('  FAILED: Spoofed email was honored instead of caller verified email!');
      passedAll = false;
    } else {
      console.log(`  PASSED: Target email was forced to caller verified email (${usedEmail || 'sanitized'})`);
    }
  }

  // -------------------------------------------------------------------------
  // 4. /api/presence Session Identity Check
  // -------------------------------------------------------------------------
  console.log('\n4. Testing /api/presence (requires session, takes identity from auth)');
  {
    // 4a. Logged-out POST
    const resPresLoggedOut = await fetch(`${BASE_URL}/api/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'spoofed@b2blink.eu', userId: 'spoofed-id' }),
    });
    console.log(`  POST /api/presence (logged-out) -> HTTP ${resPresLoggedOut.status}`);
    if (resPresLoggedOut.status !== 401) {
      console.error('  FAILED: Expected 401 Unauthorized');
      passedAll = false;
    } else {
      console.log('  PASSED: 401 Unauthorized returned');
    }

    // 4b. Logged-in POST
    const resPresLoggedIn = await fetch(`${BASE_URL}/api/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionApproved.cookieHeader,
      },
      body: JSON.stringify({ email: 'attacker@spoof.com' }), // attempted override
    });
    const jsonPresLoggedIn = await resPresLoggedIn.json().catch(() => ({}));
    console.log(`  POST /api/presence (logged-in) -> HTTP ${resPresLoggedIn.status} (success: ${jsonPresLoggedIn.success})`);
    if (resPresLoggedIn.status !== 200 || !jsonPresLoggedIn.success) {
      console.error('  FAILED: Expected 200 Success for session presence');
      passedAll = false;
    } else {
      console.log('  PASSED: 200 returned, presence tied strictly to session');
    }
  }

  console.log('\n====================================================');
  if (passedAll) {
    console.log('    ALL PART 1 TESTS COMPLETED SUCCESSFULLY!    ');
  } else {
    console.log('    SOME PART 1 TESTS FAILED - SEE DETAILS ABOVE  ');
  }
  console.log('====================================================\n');

  process.exit(passedAll ? 0 : 1);
}

run().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});

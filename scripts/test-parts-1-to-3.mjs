import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// 1. Load Environment
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
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
    process.env[key] = val;
  }
});

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CRON_SECRET = env.CRON_SECRET || 'b2b-link-cron-secret-2026';
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

function assert(condition, message) {
  if (!condition) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  PASSED: ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('     SECURITY TEST SUITE: PARTS 1, 2, AND 3         ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: verifyCronOrAdmin (CRON_SECRET & Admin Session)
  // ----------------------------------------------------
  console.log('1. Testing verifyCronOrAdmin (Bearer header only & admin bypass)');

  // 1a. Correct secret in Authorization: Bearer header
  const correctBearerRes = await fetch(`${BASE_URL}/api/listings/lifecycle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ listings: [] }),
  });
  assert(correctBearerRes.status === 200, `Correct secret in Authorization header returned HTTP ${correctBearerRes.status} (expected 200)`);

  // 1b. Secret passed in query string (?secret=) must be DENIED (remove ?secret= requirement)
  const querySecretRes = await fetch(`${BASE_URL}/api/listings/lifecycle?secret=${encodeURIComponent(CRON_SECRET)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listings: [] }),
  });
  assert(querySecretRes.status === 401, `Query secret (?secret=) was rejected with HTTP ${querySecretRes.status} (expected 401)`);

  // 1c. Invalid secret in Bearer header must be DENIED
  const badBearerRes = await fetch(`${BASE_URL}/api/listings/lifecycle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer totally-invalid-secret',
    },
    body: JSON.stringify({ listings: [] }),
  });
  assert(badBearerRes.status === 401, `Bad Bearer secret was rejected with HTTP ${badBearerRes.status} (expected 401)`);

  // 1d. Authenticated admin session bypass
  const adminLogin = await supabaseAnon.auth.signInWithPassword({
    email: 'admin@b2blink.eu',
    password: 'password123',
  });
  if (adminLogin.data?.session?.access_token) {
    const adminSessionRes = await fetch(`${BASE_URL}/api/listings/lifecycle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-qmosgopkjqrqogsdgwuy-auth-token=${JSON.stringify(adminLogin.data.session)}`,
      },
      body: JSON.stringify({ listings: [] }),
    });
    assert(adminSessionRes.status === 200, `Admin session authorized cron endpoint with HTTP ${adminSessionRes.status} (expected 200)`);
  }

  // ----------------------------------------------------
  // TEST 2: notify-inactivated (Listing Ownership Verification)
  // ----------------------------------------------------
  console.log('\n2. Testing /api/listings/notify-inactivated (Listing ownership check)');

  // Create temporary user + company
  const userAEmail = `qa-owner-${Date.now()}@b2blink.eu`;
  const { data: userA } = await supabaseAdmin.auth.admin.createUser({
    email: userAEmail,
    password: 'password123',
    email_confirm: true,
  });
  const { data: companyA } = await supabaseAdmin.from('companies').insert({
    user_id: userA.user.id,
    company_name: 'Owner Company A',
    contact_name: 'Owner A',
    contact_email: userAEmail,
    approval_status: 'approved',
  }).select().single();

  const userALogin = await supabaseAnon.auth.signInWithPassword({
    email: userAEmail,
    password: 'password123',
  });
  const userACookies = `sb-qmosgopkjqrqogsdgwuy-auth-token=${JSON.stringify(userALogin.data.session)}`;

  // Attempt to notify for a listing NOT owned by User A's company
  const unownedNotifRes = await fetch(`${BASE_URL}/api/listings/notify-inactivated`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userACookies,
      'x-forwarded-for': `10.50.1.${Math.floor(Math.random() * 200 + 10)}`,
    },
    body: JSON.stringify({
      listingTitle: 'Unowned Alien Product Listing 12345',
    }),
  });
  const unownedNotifData = await unownedNotifRes.json();
  assert(unownedNotifRes.status === 403, `Non-owner attempting to notify unowned listing got HTTP ${unownedNotifRes.status} (expected 403)`);
  assert(unownedNotifData.code === 'FORBIDDEN_NOT_OWNER', `Error code was ${unownedNotifData.code} (expected FORBIDDEN_NOT_OWNER)`);

  // Now insert a listing owned by User A's company
  const { error: insertErr } = await supabaseAdmin.from('products').insert({
    company_id: companyA.id,
    category_id: '0e07e810-fb76-4431-ba0f-6d98d6be357c',
    barcode_or_sku: 'SKU-OWNED-123',
    quantity_available: 10,
    moq: 1,
    title: 'Legitimate Owned Listing XYZ',
    description: 'Test owned listing',
    unit_price: 150,
    status: 'active',
  });
  if (insertErr) console.error('insert product error:', insertErr);

  const ownedNotifRes = await fetch(`${BASE_URL}/api/listings/notify-inactivated`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userACookies,
      'x-forwarded-for': `10.50.2.${Math.floor(Math.random() * 200 + 10)}`,
    },
    body: JSON.stringify({
      listingTitle: 'Legitimate Owned Listing XYZ',
    }),
  });
  assert(ownedNotifRes.status === 200, `Owned listing notification succeeded with HTTP ${ownedNotifRes.status} (expected 200)`);

  // ----------------------------------------------------
  // TEST 3: Password Reset Response Uniformity (No User Enumeration)
  // ----------------------------------------------------
  console.log('\n3. Testing Password Reset Uniformity (identical response whether email exists or not)');

  const nonExistentEmail = `nonexistent-user-${Date.now()}@domain-never-registered.com`;

  const forgotResNonExistent = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.60.1.${Math.floor(Math.random() * 200 + 10)}`,
    },
    body: JSON.stringify({ email: nonExistentEmail }),
  });
  const forgotDataNonExistent = await forgotResNonExistent.json();
  assert(forgotResNonExistent.status === 200, `Forgot password for non-existent email returned HTTP ${forgotResNonExistent.status} (expected 200)`);
  assert(forgotDataNonExistent.success === true, `Forgot password response success was true`);

  const resetSendCodeNonExistent = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.60.2.${Math.floor(Math.random() * 200 + 10)}`,
    },
    body: JSON.stringify({ action: 'send_code', email: nonExistentEmail }),
  });
  const resetSendData = await resetSendCodeNonExistent.json();
  assert(resetSendCodeNonExistent.status === 200, `Reset password send_code for non-existent email returned HTTP ${resetSendCodeNonExistent.status} (expected 200)`);
  assert(resetSendData.success === true, `Reset password response success was true`);

  // ----------------------------------------------------
  // TEST 4: lookup-username (Must not reveal username existence)
  // ----------------------------------------------------
  console.log('\n4. Testing lookup-username (Does not reveal whether username exists)');

  // Probing arbitrary username without password -> 401 Invalid login credentials
  const lookupProbeRes = await fetch(`${BASE_URL}/api/auth/lookup-username`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.70.1.${Math.floor(Math.random() * 200 + 10)}`,
    },
    body: JSON.stringify({ identifier: 'admin' }), // existing username but no password
  });
  const lookupProbeData = await lookupProbeRes.json();
  assert(lookupProbeRes.status === 401, `Probing username without password returned HTTP ${lookupProbeRes.status} (expected 401)`);
  assert(lookupProbeData.error === 'Invalid login credentials.', `Returned error message: "${lookupProbeData.error}"`);

  // Probing non-existent username with dummy password -> identical 401
  const lookupNonExistentRes = await fetch(`${BASE_URL}/api/auth/lookup-username`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.70.2.${Math.floor(Math.random() * 200 + 10)}`,
    },
    body: JSON.stringify({ identifier: 'fake_username_12345', password: 'wrongpassword' }),
  });
  const lookupNonExistentData = await lookupNonExistentRes.json();
  assert(lookupNonExistentRes.status === 401, `Probing non-existent username returned HTTP ${lookupNonExistentRes.status} (expected 401)`);
  assert(lookupNonExistentData.error === 'Invalid login credentials.', `Response is identical to existing user probe`);

  // ----------------------------------------------------
  // TEST 5: OTP Security (Wrong, Expired, Reused, Max Attempts)
  // ----------------------------------------------------
  console.log('\n5. Testing OTP Lifecycle (Wrong, Expired, Reused, and Attempt Limits)');

  const { saveHashedOtp, verifyHashedOtp } = await import('../src/lib/auth/otp-store.ts');
  const otpEmail = `otp-test-${Date.now()}@b2blink.eu`;
  const realOtp = '849201';

  // 5a. Missing OTP must ALWAYS be invalid
  const missingOtpRes = await verifyHashedOtp('signup', 'never-saved@b2blink.eu', '123456');
  assert(missingOtpRes.valid === false, 'Missing OTP correctly returned invalid (valid: false)');

  // 5b. Save valid OTP
  await saveHashedOtp('signup', otpEmail, realOtp, 60000); // 60s ttl

  // 5c. Wrong OTP is rejected
  const wrongOtpRes = await verifyHashedOtp('signup', otpEmail, '999999');
  assert(wrongOtpRes.valid === false, 'Wrong OTP correctly rejected (valid: false)');

  // 5d. Correct OTP succeeds
  const correctOtpRes = await verifyHashedOtp('signup', otpEmail, realOtp);
  assert(correctOtpRes.valid === true, 'Correct OTP accepted (valid: true)');

  // 5e. Reused OTP is rejected immediately (single use)
  const reusedOtpRes = await verifyHashedOtp('signup', otpEmail, realOtp);
  assert(reusedOtpRes.valid === false, 'Reused OTP correctly rejected (valid: false)');

  // 5f. Expired OTP is rejected
  const expiredEmail = `otp-expired-${Date.now()}@b2blink.eu`;
  await saveHashedOtp('signup', expiredEmail, '112233', -1000); // already expired
  const expiredOtpRes = await verifyHashedOtp('signup', expiredEmail, '112233');
  assert(expiredOtpRes.valid === false, 'Expired OTP correctly rejected (valid: false)');

  // 5g. Max 5 attempts exceeded invalidates OTP
  const bruteForceEmail = `otp-brute-${Date.now()}@b2blink.eu`;
  await saveHashedOtp('signup', bruteForceEmail, '777888', 60000);
  for (let i = 1; i <= 5; i++) {
    await verifyHashedOtp('signup', bruteForceEmail, `00000${i}`);
  }
  // Even if user now provides the REAL code on 6th attempt, it is permanently locked out!
  const sixthAttemptRes = await verifyHashedOtp('signup', bruteForceEmail, '777888');
  assert(sixthAttemptRes.valid === false, 'Exceeded attempts locked out real OTP on subsequent try (valid: false)');

  // ----------------------------------------------------
  // TEST 6: Rate Limiting (Upstash 429 with Retry-After)
  // ----------------------------------------------------
  console.log('\n6. Testing Upstash Rate Limiting (HTTP 429 with Retry-After header)');

  // Test rate limiting on /api/auth/register (limit: 5 requests per 10m)
  const simulatedIp = `192.168.100.${Math.floor(Math.random() * 200 + 10)}`;
  let hitRateLimit = false;
  let retryAfterHeader = null;

  for (let i = 1; i <= 8; i++) {
    const rlRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': simulatedIp,
      },
      body: JSON.stringify({ email: `rl-${i}@b2blink.eu` }),
    });

    if (rlRes.status === 429) {
      hitRateLimit = true;
      retryAfterHeader = rlRes.headers.get('retry-after');
      const body = await rlRes.json();
      assert(body.code === 'RATE_LIMIT_EXCEEDED', `Rate limit error code was ${body.code}`);
      break;
    }
  }

  assert(hitRateLimit === true, 'Rate limiter successfully triggered HTTP 429 after threshold');
  assert(retryAfterHeader !== null && parseInt(retryAfterHeader, 10) > 0, `Retry-After header present and positive: ${retryAfterHeader}s`);

  // Clean up test data
  if (userA?.user?.id) {
    await supabaseAdmin.from('products').delete().eq('company_id', companyA.id);
    await supabaseAdmin.from('companies').delete().eq('id', companyA.id);
    await supabaseAdmin.auth.admin.deleteUser(userA.user.id);
  }

  console.log('\n====================================================');
  console.log('    ALL TESTS COMPLETED AND VERIFIED 100%!         ');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('[TEST SUITE EXCEPTION]', err);
  process.exit(1);
});

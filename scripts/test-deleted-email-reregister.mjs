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
const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('=== VERIFYING OPTION A: DELETED EMAIL RE-REGISTRATION ===\n');

  const testEmail = `qa-re-reg-${Date.now()}@b2blink.eu`;
  const password = 'TestPassword2026!';
  const username = `rereg${Date.now().toString().slice(-6)}`;

  const testIp = `192.168.10.${Math.floor(Math.random() * 200) + 10}`;

  // ---------------------------------------------------------------------------
  // Step 1: Initial Registration
  // ---------------------------------------------------------------------------
  console.log(`Step 1: Registering new account with email: ${testEmail}...`);
  const reg1Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': testIp,
    },
    body: JSON.stringify({
      email: testEmail,
      password,
      username,
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Option A Test Corp',
      membershipTier: 'bronze',
    }),
  });
  const reg1Data = await reg1Res.json();
  console.log(`Status: ${reg1Res.status}, Success: ${reg1Data.success}, UserID: ${reg1Data.userId}, CompanyID: ${reg1Data.companyId}`);
  if (reg1Res.status !== 200 || !reg1Data.success) {
    throw new Error(`Initial registration failed: ${JSON.stringify(reg1Data)}`);
  }

  const user1Id = reg1Data.userId;
  const comp1Id = reg1Data.companyId;

  // Confirm email so the user is marked as verified
  await admin.auth.admin.updateUserById(user1Id, { email_confirm: true });
  console.log('✔ User 1 confirmed and active.\n');

  // ---------------------------------------------------------------------------
  // Step 2: Attempt duplicate registration while account is active (Expected: 409 Conflict)
  // ---------------------------------------------------------------------------
  console.log('Step 2: Attempting duplicate registration while active...');
  const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': testIp,
    },
    body: JSON.stringify({
      email: testEmail,
      password,
      username: `${username}2`,
      firstName: 'Test2',
      lastName: 'User2',
      companyName: 'Duplicate Corp',
    }),
  });
  const dupData = await dupRes.json();
  console.log(`Status: ${dupRes.status}, Error: "${dupData.error}"`);
  if (dupRes.status === 409) {
    console.log('✔ Duplicate registration correctly refused with HTTP 409 Conflict\n');
  } else {
    throw new Error(`Expected HTTP 409, got ${dupRes.status}`);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Admin deletes the account via /api/admin/accounts
  // ---------------------------------------------------------------------------
  console.log('Step 3: Authenticating admin and deleting account...');
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

  const loginRes = await client.auth.signInWithPassword({
    email: 'admin@b2blink.eu',
    password: process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPassword2026!',
  });
  if (loginRes.error) {
    throw new Error(`Admin login failed: ${loginRes.error.message}`);
  }

  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');

  const delRes = await fetch(`${BASE_URL}/api/admin/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      action: 'delete',
      companyId: comp1Id,
    }),
  });
  const delData = await delRes.json();
  console.log(`DELETE /api/admin/accounts Status: ${delRes.status}, Body:`, delData);
  if (delRes.status !== 200 || !delData.success) {
    throw new Error(`Admin account deletion failed: ${JSON.stringify(delData)}`);
  }

  // Verify company & user are gone
  const { data: compCheck } = await admin.from('companies').select('id').eq('id', comp1Id).maybeSingle();
  const { data: userCheck } = await admin.auth.admin.getUserById(user1Id);

  if (compCheck || userCheck?.user) {
    throw new Error('Account was not fully removed after deletion');
  }
  console.log('✔ Verified old company and old auth user are completely removed\n');

  // ---------------------------------------------------------------------------
  // Step 4: Re-register with the exact same email (Option A)
  // ---------------------------------------------------------------------------
  console.log(`Step 4: Re-registering with the exact same email: ${testEmail}...`);
  const reregRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': testIp,
    },
    body: JSON.stringify({
      email: testEmail,
      password: 'NewPassword2026!',
      username: `new${username.slice(-5)}`,
      firstName: 'Reborn',
      lastName: 'User',
      companyName: 'Fresh Re-registered Corp',
      membershipTier: 'bronze',
    }),
  });
  const reregData = await reregRes.json();
  console.log(`Status: ${reregRes.status}, Success: ${reregData.success}, UserID: ${reregData.userId}, CompanyID: ${reregData.companyId}`);

  if (reregRes.status !== 200 || !reregData.success) {
    throw new Error(`Re-registration failed: ${JSON.stringify(reregData)}`);
  }

  const user2Id = reregData.userId;
  const comp2Id = reregData.companyId;

  if (user2Id === user1Id) throw new Error('Expected brand new user ID for re-registration');
  if (comp2Id === comp1Id) throw new Error('Expected brand new company ID for re-registration');

  // Verify DB state of re-registered company
  const { data: comp2Db } = await admin.from('companies').select('*').eq('id', comp2Id).single();
  if (!comp2Db) throw new Error('Re-registered company record not found in database');
  if (comp2Db.approval_status !== 'pending') throw new Error(`Expected pending status, got: ${comp2Db.approval_status}`);
  if (comp2Db.tier !== 'bronze') throw new Error(`Expected bronze tier, got: ${comp2Db.tier}`);

  console.log(`✔ Brand new user created: ${user2Id} (distinct from deleted user: ${user1Id})`);
  console.log(`✔ Brand new company created: ${comp2Id} (distinct from deleted company: ${comp1Id})`);
  console.log(`✔ Status is strictly pending: ${comp2Db.approval_status}, tier: ${comp2Db.tier}\n`);

  // Cleanup re-registered user
  console.log('Cleaning up test artifacts...');
  await admin.from('companies').delete().eq('id', comp2Id);
  await admin.auth.admin.deleteUser(user2Id);
  console.log('✔ Test cleanup complete.\n');

  console.log('🎉 ALL OPTION A RE-REGISTRATION CHECKS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

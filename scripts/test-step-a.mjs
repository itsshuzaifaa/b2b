import * as fs from 'fs';
import * as path from 'path';

// Load .env.local into process.env for standalone test script
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

import { createAdminClient } from '../src/lib/supabase/server';
import { isUserAdmin } from '../src/lib/auth/guards';

console.log('====================================================');
console.log(' STEP A VERIFICATION: Central Authorization Helpers');
console.log('====================================================\n');

async function testCreateAdminClientNoKey() {
  console.log('[Test 1] createAdminClient() throws if SUPABASE_SERVICE_ROLE_KEY is missing:');
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      createAdminClient();
      console.error('  FAIL: createAdminClient() did not throw!');
      return false;
    } catch (err) {
      if (err.message.includes('Missing SUPABASE_SERVICE_ROLE_KEY')) {
        console.log('  PASS: Successfully caught expected error ->', err.message);
        return true;
      } else {
        console.error('  FAIL: Threw unexpected error ->', err.message);
        return false;
      }
    }
  } finally {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}

async function testUserAdminGuard() {
  console.log('\n[Test 2] isUserAdmin() server-side enforcement:');

  // Test 2a: Null user
  const nullCheck = await isUserAdmin(null);
  console.log(`  2a. Null user: ${nullCheck === false ? 'PASS (false)' : 'FAIL'}`);

  // Test 2b: Client-spoofed user_metadata.role = 'admin' MUST BE REJECTED
  const spoofedUser = {
    id: 'spoofed-user-id',
    email: 'hacker@example.com',
    user_metadata: { role: 'admin', is_admin: true }, // Client-writable!
    app_metadata: {}, // Empty tamper-proof metadata
  };
  const spoofedCheck = await isUserAdmin(spoofedUser);
  console.log(`  2b. Spoofed user_metadata.role='admin': ${spoofedCheck === false ? 'PASS (rejected, returned false)' : 'FAIL (allowed spoofing!)'}`);

  // Test 2c: Legitimate app_metadata.role = 'admin' MUST BE ACCEPTED
  const legitimateAdminUser = {
    id: 'admin-user-id',
    email: 'legit-admin@b2blink.eu',
    user_metadata: {},
    app_metadata: { role: 'admin' }, // Tamper-proof JWT claim
  };
  const legitCheck = await isUserAdmin(legitimateAdminUser);
  console.log(`  2c. Legitimate app_metadata.role='admin': ${legitCheck === true ? 'PASS (accepted, returned true)' : 'FAIL'}`);

  // Test 2d: Legitimate app_metadata.is_admin = true MUST BE ACCEPTED
  const boolAdminUser = {
    id: 'admin-user-2-id',
    email: 'admin-bool@b2blink.eu',
    user_metadata: {},
    app_metadata: { is_admin: true },
  };
  const boolCheck = await isUserAdmin(boolAdminUser);
  console.log(`  2d. Legitimate app_metadata.is_admin=true: ${boolCheck === true ? 'PASS (accepted, returned true)' : 'FAIL'}`);

  return !nullCheck && !spoofedCheck && legitCheck && boolCheck;
}

async function run() {
  const t1 = await testCreateAdminClientNoKey();
  const t2 = await testUserAdminGuard();

  console.log('\n----------------------------------------------------');
  if (t1 && t2) {
    console.log('ALL STEP A UNIT TESTS PASSED SUCCESSFULLY! (100%)');
  } else {
    console.error('SOME STEP A TESTS FAILED!');
    process.exit(1);
  }
}

run().catch(console.error);

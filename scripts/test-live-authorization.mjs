import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
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

import { isUserAdmin } from '../src/lib/auth/guards';
import { createAdminClient } from '../src/lib/supabase/server';

async function testLiveAuth() {
  console.log('===========================================================');
  console.log(' LIVE SUPABASE AUTHORIZATION TEST WITH REAL DATABASE RECORDS');
  console.log('===========================================================\n');

  const adminClient = createAdminClient();
  const { data: usersData, error } = await adminClient.auth.admin.listUsers();
  if (error || !usersData?.users) {
    throw new Error('Failed to list users: ' + error?.message);
  }

  const users = usersData.users;
  console.log(`Found ${users.length} live Supabase Auth users.\n`);

  const realAdmin = users.find((u) => u.email?.toLowerCase() === 'admin@b2blink.eu');
  const regularUser = users.find((u) => u.email?.toLowerCase() !== 'admin@b2blink.eu');

  if (!realAdmin) {
    console.error('FAIL: admin@b2blink.eu user not found in auth.users');
    process.exit(1);
  }

  console.log('[Test 1] Testing Real Administrator user (admin@b2blink.eu):');
  console.log(`  User ID: ${realAdmin.id}`);
  console.log(`  Email: ${realAdmin.email}`);
  const adminResult = await isUserAdmin(realAdmin);
  console.log(`  isUserAdmin(realAdmin) returned: ${adminResult}`);
  if (adminResult === true) {
    console.log('  -> PASS: Verified administrator identified via public.admins table!\n');
  } else {
    console.error('  -> FAIL: Administrator was not verified!\n');
    process.exit(1);
  }

  if (regularUser) {
    console.log('[Test 2] Testing Regular User (non-admin):');
    console.log(`  User ID: ${regularUser.id}`);
    console.log(`  Email: ${regularUser.email}`);
    
    // Simulate regular user attempting to claim admin via user_metadata
    const regularWithSpoofedMeta = {
      ...regularUser,
      user_metadata: { role: 'admin', is_admin: true },
    };
    const regularResult = await isUserAdmin(regularWithSpoofedMeta);
    console.log(`  isUserAdmin(regularUser with spoofed user_metadata) returned: ${regularResult}`);
    if (regularResult === false) {
      console.log('  -> PASS: Regular user successfully BLOCKED from acquiring admin rights!\n');
    } else {
      console.error('  -> FAIL: Regular user improperly granted admin access!\n');
      process.exit(1);
    }
  }

  console.log('[Test 3] Testing Anonymous / Null User:');
  const nullResult = await isUserAdmin(null);
  console.log(`  isUserAdmin(null) returned: ${nullResult}`);
  if (nullResult === false) {
    console.log('  -> PASS: Anonymous request correctly denied admin rights!\n');
  } else {
    console.error('  -> FAIL: Null user granted admin access!\n');
    process.exit(1);
  }

  console.log('===========================================================');
  console.log(' ALL LIVE DATABASE AUTHORIZATION TESTS PASSED! (100%)');
  console.log('===========================================================');
}

testLiveAuth().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

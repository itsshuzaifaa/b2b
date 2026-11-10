import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
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

async function run() {
  console.log('=== VERIFYING ADMIN ACCOUNT DELETION (STRICTLY BY ID & USER_ID) ===\n');

  // 1. Create a dummy test user and company
  const testEmail = `del-test-${Date.now()}@testcompany.org`;
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: 'TestPassword123!',
    email_confirm: true,
  });

  if (authErr) {
    console.error('Failed to create test user:', authErr);
    process.exit(1);
  }

  const userId = authData.user.id;
  const { data: compData, error: compErr } = await admin
    .from('companies')
    .insert({
      user_id: userId,
      company_name: 'Test Deletion Co',
      contact_name: 'Delete Me',
      contact_email: testEmail,
      role: 'seller',
      approval_status: 'pending',
    })
    .select('id')
    .single();

  if (compErr) {
    console.error('Failed to insert test company:', compErr);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  const companyId = compData.id;
  console.log(`Created test user: ${userId}, company: ${companyId}`);

  // 2. Login as admin
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
    console.error('Admin login failed:', loginRes.error);
    process.exit(1);
  }

  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');

  // 3. Admin calls DELETE by companyId
  console.log('Admin calling POST /api/admin/accounts with action: "delete"...');
  const res = await fetch(`${BASE_URL}/api/admin/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      action: 'delete',
      companyId: companyId,
    }),
  });

  const body = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Response body:', JSON.stringify(body));

  // 4. Verify in Supabase that the company and user are gone
  const { data: compCheck } = await admin.from('companies').select('id').eq('id', companyId).maybeSingle();
  const { data: userCheck } = await admin.auth.admin.getUserById(userId);

  console.log('Company exists after deletion:', Boolean(compCheck));
  console.log('Auth user exists after deletion:', Boolean(userCheck?.user));

  if (!compCheck && !userCheck?.user && res.status === 200) {
    console.log('\n[SUCCESS] Account deleted strictly by id and user_id without errors!');
  } else {
    console.error('\n[FAIL] Account was not deleted properly.');
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

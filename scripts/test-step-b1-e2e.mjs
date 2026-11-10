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

async function run() {
  console.log('--- TEST 1: ADMIN LOGIN & ACCESS TO /site-admin ---');
  let adminJar = {};
  const adminClient = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return Object.entries(adminJar).map(([name, value]) => ({ name, value })); },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => { adminJar[name] = value; }); },
    },
  });

  const { data: aData, error: aErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@b2blink.eu',
    password: 'AdminPassword2026!',
  });
  console.log('Admin login error:', aErr?.message || 'NONE (Success)');
  const adminCookieHeader = Object.entries(adminJar).map(([k, v]) => `${k}=${v}`).join('; ');

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const resAdmin = await fetch(`${BASE_URL}/site-admin`, {
    headers: { Cookie: adminCookieHeader },
    redirect: 'manual',
  });
  console.log('HTTP Status for Admin:', resAdmin.status);
  const adminHtml = await resAdmin.text();
  console.log('Admin Shell rendered:', adminHtml.includes('ROOT DESK') && adminHtml.includes('admin@b2blink.eu'));

  console.log('\n--- TEST 2: NON-ADMIN USER ACCESS TO /site-admin ---');
  // Create temp non-admin
  const tempEmail = 'regular-member@example.com';
  const tempPwd = 'MemberPassword2026!';
  let { data: { users } } = await admin.auth.admin.listUsers();
  let existing = users.find(u => u.email === tempEmail);
  if (!existing) {
    const { data: nu } = await admin.auth.admin.createUser({
      email: tempEmail,
      password: tempPwd,
      email_confirm: true,
      user_metadata: { role: 'seller' },
    });
    existing = nu.user;
  } else {
    await admin.auth.admin.updateUserById(existing.id, { password: tempPwd, email_confirm: true });
  }

  let userJar = {};
  const userClient = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return Object.entries(userJar).map(([name, value]) => ({ name, value })); },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => { userJar[name] = value; }); },
    },
  });

  const { error: uErr } = await userClient.auth.signInWithPassword({
    email: tempEmail,
    password: tempPwd,
  });
  console.log('Regular user login error:', uErr?.message || 'NONE (Success)');
  const userCookieHeader = Object.entries(userJar).map(([k, v]) => `${k}=${v}`).join('; ');

  const resUser = await fetch(`${BASE_URL}/site-admin`, {
    headers: { Cookie: userCookieHeader },
    redirect: 'manual',
  });
  console.log('HTTP Status for Regular User:', resUser.status);
  const userHtml = await resUser.text();
  console.log('403 Forbidden Screen rendered:', userHtml.includes('403 ACCESS DENIED') && userHtml.includes('Administrator Access Required'));

  // Clean up
  await admin.auth.admin.deleteUser(existing.id);

  console.log('\n--- TEST 3: UNLOGGED VISITOR ACCESS TO /site-admin ---');
  const resGuest = await fetch(`${BASE_URL}/site-admin`, {
    redirect: 'manual',
  });
  console.log('HTTP Status for Logged-Out Visitor:', resGuest.status);
  console.log('Redirect Location:', resGuest.headers.get('location'));
}

run().catch(console.error);

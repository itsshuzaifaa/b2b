import { createClient } from '@supabase/supabase-js';
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAll() {
  console.log('--- STARTING COMPLETE DATABASE CLEANUP ---');

  // 1. Delete all inquiries
  const { error: inqErr } = await admin.from('product_inquiries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared product_inquiries:', inqErr ? inqErr.message : 'SUCCESS');

  // 2. Delete all wtb requests
  const { error: wtbErr } = await admin.from('wtb_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared wtb_requests:', wtbErr ? wtbErr.message : 'SUCCESS');

  // 3. Delete all products
  const { error: prodErr } = await admin.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared products:', prodErr ? prodErr.message : 'SUCCESS');

  // 4. Delete companies except admin
  const { error: compErr } = await admin.from('companies').delete().neq('role', 'admin');
  console.log('Cleared non-admin companies:', compErr ? compErr.message : 'SUCCESS');

  // 5. Delete all auth users except admin@b2blink.eu
  const { data: usersData } = await admin.auth.admin.listUsers();
  if (usersData?.users) {
    for (const u of usersData.users) {
      if (u.email?.toLowerCase() !== 'admin@b2blink.eu') {
        const { error: delUserErr } = await admin.auth.admin.deleteUser(u.id);
        console.log(`Deleted user ${u.email}:`, delUserErr ? delUserErr.message : 'OK');
      } else {
        console.log(`Preserved platform admin: ${u.email}`);
      }
    }
  }

  console.log('--- CLEANUP COMPLETE ---');
}

cleanAll().catch(console.error);

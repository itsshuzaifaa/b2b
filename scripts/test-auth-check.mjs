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
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: users, error: uErr } = await admin.auth.admin.listUsers();
  console.log('AUTH USERS COUNT:', users?.users?.length);
  users?.users?.forEach(u => {
    console.log(`- ${u.email} | confirmed: ${!!u.email_confirmed_at} | username: ${u.user_metadata?.username} | role: ${u.user_metadata?.role}`);
  });
  const { data: anonComps, error: anonErr } = await anon.from('companies').select('id, user_id, contact_email, role, approval_status');
  console.log('ANON COMPANIES READ:', anonErr ? anonErr.message : `Success! Count: ${anonComps.length}`);
  anonComps?.forEach(c => {
    console.log(`- Comp ID: ${c.id} | user_id: ${c.user_id} | email: ${c.contact_email} | role: ${c.role} | status: ${c.approval_status}`);
  });
}

run();

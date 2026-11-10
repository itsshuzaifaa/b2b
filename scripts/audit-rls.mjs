import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
  }
});

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const tables = [
  'companies',
  'categories',
  'products',
  'product_inquiries',
  'wtb_requests',
  'quotations',
  'wtb_notifications_queue',
];

async function run() {
  console.log('==============================================');
  console.log(' SUPABASE TABLE PERMISSIONS & RLS AUDIT');
  console.log('==============================================\n');

  for (const table of tables) {
    console.log(`Checking [${table}]...`);
    const { data: adminRows, error: adminErr } = await adminClient.from(table).select('*').limit(1);
    if (adminErr) {
      console.log(`  [Admin/ServiceRole] ERROR: ${adminErr.message}`);
    } else {
      console.log(`  [Admin/ServiceRole] Accessible. (Sample row exists: ${adminRows.length > 0})`);
    }

    const { data: anonRows, error: anonErr } = await anonClient.from(table).select('*').limit(5);
    if (anonErr) {
      console.log(`  [Anon SELECT] DENIED: ${anonErr.message} (code: ${anonErr.code})`);
    } else {
      console.log(`  [Anon SELECT] ALLOWED: Returned ${anonRows?.length || 0} rows!`);
    }

    // Try a dummy update with anon
    const { data: anonUpdate, error: anonUpdateErr } = await anonClient
      .from(table)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    if (anonUpdateErr) {
      console.log(`  [Anon UPDATE] DENIED: ${anonUpdateErr.message} (code: ${anonUpdateErr.code})`);
    } else {
      console.log(`  [Anon UPDATE] Policy passed or 0 rows modified (Result: ${JSON.stringify(anonUpdate)})`);
    }

    // Try a dummy delete with anon
    const { data: anonDel, error: anonDelErr } = await anonClient
      .from(table)
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    if (anonDelErr) {
      console.log(`  [Anon DELETE] DENIED: ${anonDelErr.message} (code: ${anonDelErr.code})`);
    } else {
      console.log(`  [Anon DELETE] Policy passed or 0 rows deleted (Result: ${JSON.stringify(anonDel)})`);
    }

    console.log('');
  }
}

run().catch(console.error);

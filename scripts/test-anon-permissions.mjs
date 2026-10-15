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

async function testAnon() {
  console.log('Testing select with anon key...');
  const { data, error } = await anonClient.from('product_inquiries').select('*').limit(1);
  console.log('Anon select error:', error?.message || 'NONE (OK!)', 'Rows:', data?.length);

  if (data && data.length > 0) {
    const row = data[0];
    console.log('Testing update with anon key on row', row.id);
    const { error: updateErr } = await anonClient
      .from('product_inquiries')
      .update({ status: row.status })
      .eq('id', row.id);
    console.log('Anon update error:', updateErr?.message || 'NONE (OK!)');
  }
}

testAnon().catch(console.error);

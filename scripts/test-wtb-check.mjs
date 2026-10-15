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

async function run() {
  const { data, error } = await admin.rpc('get_columns', { table_name: 'wtb_requests' });
  if (error) {
    // Try querying a dummy row with empty object to see what schema says or inspect
    const { data: d2, error: e2 } = await admin.from('wtb_requests').select('*').limit(1);
    console.log('Select * result:', e2 || d2);
    // Let's test insert with minimal fields
    const { data: d3, error: e3 } = await admin.from('wtb_requests').insert({}).select('*');
    console.log('Empty insert error:', e3);
  } else {
    console.log('RPC columns:', data);
  }
}

run();

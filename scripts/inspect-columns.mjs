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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
  const { data: inq } = await supabase.from('product_inquiries').select('*').limit(1);
  console.log('product_inquiries keys:', inq && inq[0] ? Object.keys(inq[0]) : 'empty');
  const { data: wtb } = await supabase.from('wtb_requests').select('*').limit(1);
  console.log('wtb_requests keys:', wtb && wtb[0] ? Object.keys(wtb[0]) : 'empty');
  const { data: pay } = await supabase.from('payments').select('*').limit(1);
  console.log('payments keys:', pay && pay[0] ? Object.keys(pay[0]) : 'empty');
  const { data: comp } = await supabase.from('companies').select('*').limit(1);
  console.log('companies keys:', comp && comp[0] ? Object.keys(comp[0]) : 'empty');
}

inspectSchema().catch(console.error);

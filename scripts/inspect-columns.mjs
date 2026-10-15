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
  // Try querying pg columns if possible or insert dummy and catch error with column names
  const { data: inqErr, error: err1 } = await supabase.from('product_inquiries').insert({}).select();
  console.log('product_inquiries insert error (shows constraints/not-null):', err1);

  const { data: prodErr, error: err2 } = await supabase.from('products').insert({}).select();
  console.log('products insert error:', err2);
}

inspectSchema().catch(console.error);

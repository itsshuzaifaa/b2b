import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: companies, error: compErr } = await supabase.from('companies').select('id, company_name, contact_email, approval_status, tier');
  const { data: products, error: prodErr } = await supabase.from('products').select('id, title, company_id, unit_price, moq');
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();

  console.log('--- AUTH USERS ---');
  if (authErr) console.error(authErr);
  else console.log(authUsers.users.map(u => ({ id: u.id, email: u.email, meta: u.user_metadata })));

  console.log('--- COMPANIES ---');
  if (compErr) console.error(compErr);
  else console.log(companies);

  console.log('--- PRODUCTS ---');
  if (prodErr) console.error(prodErr);
  else console.log(products);
}

main();

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
  const { data: companies } = await supabase.from('companies').select('id, company_name, contact_name, contact_email, role, tier');
  const { data: products } = await supabase.from('products').select('id, title, company_id, unit_price, moq');
  const { data: inquiries } = await supabase.from('product_inquiries').select('id, product_id, seller_company_id, buyer_name, buyer_email, buyer_company, status');

  console.log('--- COMPANIES ---');
  console.log(companies);
  console.log('--- PRODUCTS ---');
  console.log(products);
  console.log('--- INQUIRIES ---');
  console.log(inquiries);
}

main();

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('--- ADDING LIVE BUYER INQUIRY FOR APEX WHOLESALE ---');

  const { data: companies } = await supabase.from('companies').select('*');
  const apex = companies.find((c) => c.company_name?.toLowerCase().includes('apex wholesale'));
  const ukBuyer = companies.find((c) => c.role === 'buyer');

  const { data: products } = await supabase.from('products').select('*');
  const prod = products[0];

  const tradeMsgApex = [
    {
      id: 'msg-apex-trade-1',
      senderId: ukBuyer.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      senderRole: 'buyer',
      text: 'Hello Huzaifa, we are reviewing your wholesale lot listings. Can you provide EXW terms and confirmed pallet count for immediate collection?',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      isRead: false,
    },
  ];

  const { data: inserted, error } = await supabase.from('product_inquiries').insert({
    id: '45887a24-39d6-4a73-b221-249000b12ac9',
    product_id: prod.id,
    seller_company_id: apex.id,
    buyer_name: 'Marcus Wright',
    buyer_email: 'buyer@apexretail.co.uk',
    buyer_company: 'Apex Retail Distribution UK Ltd',
    requested_quantity: 30,
    target_price: 180,
    message: JSON.stringify(tradeMsgApex),
    status: 'negotiating',
  }).select();

  console.log('Inserted trade inquiry for Apex Wholesale:', inserted ? 'OK' : error);
}

main();

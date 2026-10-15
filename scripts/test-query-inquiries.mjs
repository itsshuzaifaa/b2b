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

async function testFetch() {
  const { data, error } = await supabase
    .from('product_inquiries')
    .select(`
      id,
      product_id,
      seller_company_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_company,
      requested_quantity,
      target_price,
      message,
      status,
      created_at,
      products:products(id, title, unit_price, moq, image_urls),
      seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch inquiries error:', error);
  } else {
    console.log(`Fetched ${data.length} inquiries from Supabase!`);
    data.forEach(inq => {
      console.log(`- [${inq.id}] Status: ${inq.status} | Buyer Email: ${inq.buyer_email} | Product: "${inq.products?.title}" | Seller: ${inq.seller_company?.company_name}`);
      try {
        const msgs = JSON.parse(inq.message);
        console.log(`  Messages count: ${msgs.length}, Last: "${msgs[msgs.length - 1]?.text?.slice(0, 50)}..."`);
      } catch {
        console.log(`  Raw message: "${inq.message.slice(0, 50)}..."`);
      }
    });
  }
}

testFetch().catch(console.error);

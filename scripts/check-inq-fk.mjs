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

async function check() {
  console.log('Testing deleting a product that has an inquiry...');
  const { data: comp } = await admin.from('companies').select('id').limit(1).single();
  const { data: cat } = await admin.from('categories').select('id').limit(1).single();
  const { data: prod, error: pErr } = await admin.from('products').insert({
    company_id: comp.id,
    category_id: cat.id,
    title: 'FK Product Test',
    barcode_or_sku: `SKU-${Date.now()}`,
    unit_price: 10,
    quantity_available: 5,
    moq: 1,
    image_urls: ['https://example.com/test.jpg'],
  }).select('id').single();

  if (pErr) {
    console.error('Prod insert error:', pErr);
    return;
  }

  const { data: inq, error: inqErr } = await admin.from('product_inquiries').insert({
    product_id: prod.id,
    seller_company_id: comp.id,
    buyer_name: 'Test Buyer',
    buyer_email: 'buyer@test.internal',
    buyer_company: 'Test Buyer Co',
    requested_quantity: 1,
    message: '[]',
  }).select('id').single();

  console.log('Inquiry insert:', inq?.id, 'Error:', inqErr);

  const { error: delProdErr } = await admin.from('products').delete().eq('id', prod.id);
  console.log('Deleting product with inquiry error:', delProdErr);

  const { data: checkInq } = await admin.from('product_inquiries').select('id').eq('id', inq.id).maybeSingle();
  console.log('Inquiry after product deleted:', checkInq ? 'Still exists!' : 'Cascaded!');

  if (checkInq) await admin.from('product_inquiries').delete().eq('id', inq.id);
}

check();

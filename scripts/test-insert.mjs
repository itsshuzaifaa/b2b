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

async function testInsert() {
  const { data: companies } = await supabase.from('companies').select('id, role, company_name').limit(3);
  const seller = companies.find(c => c.role === 'seller');
  const { data: cats } = await supabase.from('categories').select('id, slug').limit(1);

  console.log('Inserting real product...');
  const { data: prod, error: pErr } = await supabase.from('products').insert({
    company_id: seller.id,
    category_id: cats[0].id,
    category_slug: cats[0].slug,
    title: 'Sony WH-1000XM5 Wireless Headphones (Sealed EU Stock)',
    description: 'Brand new, factory sealed master cartons with EU warranty and CE markings.',
    barcode_or_sku: '5013493820194',
    unit_price: 185.00,
    quantity_available: 240,
    moq: 20,
    status: 'active',
    is_hot: true,
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
  }).select().single();

  console.log('Product insert result:', pErr || prod?.id);

  if (prod) {
    console.log('Testing inquiry insert...');
    const { data: inq, error: iErr } = await supabase.from('product_inquiries').insert({
      product_id: prod.id,
      seller_company_id: seller.id,
      buyer_name: 'Marcus Wright',
      buyer_email: 'marcus@apexretail.co.uk',
      buyer_company: 'Apex Retail Distribution Ltd',
      buyer_phone: '+44 7911 123456',
      requested_quantity: 40,
      target_price: 180.00,
      message: 'Hello, looking to acquire 40 units immediately for warehouse in Birmingham. Can you confirm EXW lead time?',
      status: 'new',
    }).select().single();
    console.log('Inquiry insert result:', iErr || inq);
  }
}

testInsert().catch(console.error);

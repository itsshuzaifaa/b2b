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
  const { data: comp } = await admin.from('companies').select('id').eq('role', 'admin').single();
  const { data: cat } = await admin.from('categories').select('id').limit(1).single();

  const deskProduct = {
    id: '00000000-0000-4000-a000-000000000001',
    company_id: comp.id,
    category_id: cat.id,
    title: 'B2B LINK Desk & Procurement Support',
    description: 'Official direct channel with Jeff (Platform Director)',
    barcode_or_sku: 'B2B-DESK-SUPPORT',
    unit_price: 0,
    quantity_available: 999999,
    moq: 1,
    currency: 'EUR',
    image_urls: ['/b2b-link-logo-tight.png'],
    status: 'active',
    is_hot: false,
  };

  const { data: p, error: pErr } = await admin.from('products').upsert(deskProduct).select('*').single();
  console.log('Desk product result:', pErr ? pErr.message : p.id);

  if (p) {
    const testInq = {
      product_id: p.id,
      seller_company_id: comp.id,
      buyer_name: 'Test Buyer',
      buyer_email: 'test@example.com',
      requested_quantity: 1,
      target_price: 0,
      message: JSON.stringify([{ id: 'm1', senderId: comp.id, senderName: 'Jeff', text: 'Welcome!', timestamp: new Date().toISOString() }]),
      status: 'admin_desk'
    };
    const { data: inq, error: inqErr } = await admin.from('product_inquiries').insert(testInq).select('*').single();
    console.log('Inquiry insert result:', inqErr ? inqErr.message : inq.id);

    // Clean test inquiry
    if (inq?.id) {
      await admin.from('product_inquiries').delete().eq('id', inq.id);
    }
  }
}

run();

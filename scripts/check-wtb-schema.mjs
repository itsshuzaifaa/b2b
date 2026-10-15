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
  const { data: cat } = await admin.from('categories').select('id, name, slug').limit(1).single();
  console.log('Category:', cat);

  const testInsert = {
    buyer_name: 'Test Buyer',
    buyer_email: 'testbuyer@example.com',
    buyer_phone: '+44 7700 900077',
    buyer_company: 'Test Buyer Ltd',
    category_id: cat.id,
    product_name: 'Apple iPhone 15 Pro Max 256GB',
    barcode_or_sku: '195949038291',
    target_quantity: 30,
    target_price: 850.00,
    status: 'open',
    notes: 'Urgent wholesale request for UK distribution depot'
  };

  const { data: inserted, error: insertError } = await admin.from('wtb_requests').insert(testInsert).select('*').single();
  console.log('Insert Result:', insertError || inserted);

  // Clean it up immediately
  if (inserted?.id) {
    await admin.from('wtb_requests').delete().eq('id', inserted.id);
    console.log('Cleaned up test row successfully.');
  }
}

run();

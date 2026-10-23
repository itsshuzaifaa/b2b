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

const SYSTEM_PROD_ID = '00000000-0000-4000-a000-000000000001';
const ADMIN_COMPANY_ID = 'facbb93f-080f-480f-b54b-8ef26664da86';

async function seedSystemProduct() {
  const { data: cat } = await admin.from('categories').select('id').limit(1).single();

  const { data, error } = await admin.from('products').upsert({
    id: SYSTEM_PROD_ID,
    company_id: ADMIN_COMPANY_ID,
    category_id: cat?.id || null,
    title: 'B2B LINK System Communication Desk',
    description: 'System anchor product for platform broadcasts, admin communications, and trade desk support.',
    barcode_or_sku: 'SYS-DESK-001',
    unit_price: 0,
    quantity_available: 1,
    moq: 1,
    status: 'draft',
    is_hot: false,
    image_urls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
  }).select().single();

  if (error) {
    console.error('Failed to seed system product:', error);
  } else {
    console.log('Successfully seeded system product:', data.id, data.title);
  }
}

seedSystemProduct();

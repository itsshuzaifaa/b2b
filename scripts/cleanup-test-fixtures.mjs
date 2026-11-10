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

const TEST_PRODUCT_IDS = [
  '7b118826-4c42-431e-9fdc-8da1c61072da',
  '052b607f-44dc-4e2b-abc6-c3325fffed95',
  '0f998d8f-0cdc-4928-b83e-a5b279851cdf',
  '773a4750-04ed-44e1-9670-099207ef47ec',
  '0838b6ee-e2d8-4be1-9847-666948851b0c',
  'd38d3ed6-cee5-46ef-866a-7ce755532203',
  'ff525b2a-4656-4207-8ae1-69e659119156',
];

const TEST_COMPANY_IDS = [
  'b54df6aa-0293-438d-9245-b31431f7567e',
  '84e02d69-2e51-4440-b1c0-fce2a621bc08',
  'ca1608b8-c537-47f4-ab04-578b53b9d36a',
  '995c52b7-41ae-4ef6-bd45-5f38dc4758ff',
  'dea216d4-53d5-4761-82c9-d8314827ecc9',
  '51713902-afb3-4177-ab19-7e2b62ebd75a',
  '875d3257-8b1b-4dda-bd08-dc7b97d463b1',
  'cff2976a-cfcf-40b2-afbc-8aa4f4636147',
  '7863396a-9144-4814-96d0-8c9ff02adb19',
  'ebc14039-fa5a-485a-9fd9-12a5b30e0472',
];

const TEST_USER_IDS = [
  '63d85477-1a2a-45d2-8c6c-891e6babe915',
  'cbad095f-b814-4f5c-84ed-b25914548721',
  '6088d754-c92b-46aa-a59a-e1fa5112a5ed',
  '5dfc7486-2a1e-48e0-a03c-5ea25592a254',
];

async function cleanup() {
  console.log('Starting cleanup of automated test fixtures...');

  // 1. Delete test products
  const { error: prodErr, count: prodCount } = await admin
    .from('products')
    .delete()
    .in('id', TEST_PRODUCT_IDS);
  console.log(`Deleted ${prodCount ?? TEST_PRODUCT_IDS.length} test products. Error:`, prodErr?.message || 'none');

  // 2. Delete test companies and dependent records
  for (const cId of TEST_COMPANY_IDS) {
    await admin.from('quotations').delete().eq('seller_company_id', cId);
    await admin.from('product_inquiries').delete().eq('seller_company_id', cId);
    await admin.from('wtb_notifications_queue').delete().eq('seller_company_id', cId);
    await admin.from('products').delete().eq('company_id', cId);
    await admin.from('companies').delete().eq('id', cId);
  }
  console.log(`Deleted ${TEST_COMPANY_IDS.length} test companies.`);

  // 3. Delete test auth users
  for (const uId of TEST_USER_IDS) {
    try {
      await admin.auth.admin.deleteUser(uId);
    } catch (err) {
      console.warn(`User ${uId} delete notice:`, err.message);
    }
  }
  console.log(`Deleted ${TEST_USER_IDS.length} test auth users.`);

  console.log('Cleanup script completed.');
}

// NOTE: DO NOT execute automatically. Only run when explicitly instructed by user.
// cleanup();
export { cleanup };

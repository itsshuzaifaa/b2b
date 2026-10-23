import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read environment variables
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function pass(name: string, detail: string = '') {
  passed++;
  console.log(`  ✓ PASS: ${name} ${detail ? '(' + detail + ')' : ''}`);
}

function fail(name: string, detail: string = '') {
  failed++;
  console.error(`  ✗ FAIL: ${name} - ${detail}`);
}

async function run() {
  const { importProductsFromCsv } = await import('../src/lib/importers/csv-product-importer');
  console.log('=== STARTING CSV IMPORTER & AUTH VERIFICATION TESTS ===\n');

  const testId = Date.now().toString().slice(-6);
  const sellerEmail = `csv_test_seller_${testId}@qa-testing.b2blink.internal`;
  const bronzeEmail = `csv_test_bronze_${testId}@qa-testing.b2blink.internal`;
  const testPassword = 'InitialSecurePassword123!';

  let goldUserId: string | null = null;
  let goldCompanyId: string | null = null;
  let bronzeUserId: string | null = null;
  let bronzeCompanyId: string | null = null;

  try {
    // 1. Get first category
    const { data: categories } = await admin.from('categories').select('id, name, slug');
    const targetCategory = categories?.[0];
    if (!targetCategory) throw new Error('No categories found in database');
    pass('Category Lookup', `Target Category: ${targetCategory.name} (${targetCategory.slug})`);

    // 2. Create Gold Seller Company
    const { data: goldAuth, error: goldAuthErr } = await admin.auth.admin.createUser({
      email: sellerEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        company_name: `CSV Gold Supplier ${testId}`,
        role: 'seller',
        tier: 'gold',
        approval_status: 'approved',
      },
    });
    if (goldAuthErr) throw goldAuthErr;
    goldUserId = goldAuth.user.id;

    const { data: goldComp, error: goldCompErr } = await admin
      .from('companies')
      .insert({
        user_id: goldUserId,
        company_name: `CSV Gold Supplier ${testId}`,
        contact_name: 'CSV Test Manager',
        contact_email: sellerEmail,
        phone: '+44 7700 900123',
        role: 'seller',
        approval_status: 'approved',
        tier: 'gold',
        niches: [targetCategory.id],
      })
      .select()
      .single();
    if (goldCompErr) throw goldCompErr;
    goldCompanyId = goldComp.id;
    pass('Gold Company Setup', `ID: ${goldCompanyId}`);

    // 3. Create Bronze Seller Company (to verify tier blocking)
    const { data: bronzeAuth, error: bronzeAuthErr } = await admin.auth.admin.createUser({
      email: bronzeEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        company_name: `CSV Bronze Supplier ${testId}`,
        role: 'seller',
        tier: 'bronze',
        approval_status: 'approved',
      },
    });
    if (bronzeAuthErr) throw bronzeAuthErr;
    bronzeUserId = bronzeAuth.user.id;

    const { data: bronzeComp, error: bronzeCompErr } = await admin
      .from('companies')
      .insert({
        user_id: bronzeUserId,
        company_name: `CSV Bronze Supplier ${testId}`,
        contact_name: 'Bronze Manager',
        contact_email: bronzeEmail,
        phone: '+44 7700 900456',
        role: 'seller',
        approval_status: 'approved',
        tier: 'bronze',
        niches: [targetCategory.id],
      })
      .select()
      .single();
    if (bronzeCompErr) throw bronzeCompErr;
    bronzeCompanyId = bronzeComp.id;
    pass('Bronze Company Setup', `ID: ${bronzeCompanyId}`);

    // 4. Test Bronze Tier CSV Upload Rejection
    console.log('\n>>> Testing CSV Tier Permissions...');
    const dummyCsv = `title,category_slug,barcode_or_sku,unit_price,quantity_available,moq
Test Item,${targetCategory.slug},BAR12345,10.00,10,1`;
    const bronzeResult = await importProductsFromCsv({
      companyId: bronzeCompanyId,
      csvContent: dummyCsv,
    });

    if (!bronzeResult.success && bronzeResult.errors[0]?.message.includes('requires Silver or Gold tier')) {
      pass('Bronze Tier Blocking', 'Correctly rejected CSV import for bronze tier');
    } else {
      fail('Bronze Tier Blocking', JSON.stringify(bronzeResult));
    }

    // 5. Test Gold Tier CSV Upload Success
    console.log('\n>>> Testing CSV Import with Valid Rows...');
    const validCsv = `product_name,category,barcode,price,qty,min_order,description,condition
"Apple iPhone 15 Pro 128GB Black Titanium (${testId})",${targetCategory.slug},SKU-${testId}-001,899.50,25,2,"Grade A stock with boxes","A Grade"
"Samsung Galaxy S24+ 256GB Onyx Black (${testId})",${targetCategory.slug},SKU-${testId}-002,749.00,40,5,"Brand new factory sealed units","New"`;

    const goldResult = await importProductsFromCsv({
      companyId: goldCompanyId,
      csvContent: validCsv,
    });

    if (goldResult.success && goldResult.insertedCount === 2) {
      pass('CSV Import Execution', `Successfully imported ${goldResult.insertedCount} products`);
    } else {
      fail('CSV Import Execution', JSON.stringify(goldResult));
    }

    // Verify products exist in Supabase products table
    const { data: insertedDbProds, error: verifyErr } = await admin
      .from('products')
      .select('id, title, category_id, barcode_or_sku, unit_price, quantity_available, moq, image_urls')
      .eq('company_id', goldCompanyId);

    if (verifyErr || !insertedDbProds || insertedDbProds.length !== 2) {
      fail('Database Product Verification', verifyErr?.message || `Found ${insertedDbProds?.length} rows`);
    } else {
      pass('Database Product Verification', `Found ${insertedDbProds.length} rows in database with category_id ${insertedDbProds[0].category_id}`);
    }

    // 6. Test CSV Duplicate Barcode Detection within file
    console.log('\n>>> Testing Duplicate Barcode Detection in CSV...');
    const duplicateCsv = `product_name,category,barcode,price,qty,min_order,condition
"Item A",${targetCategory.slug},DUP-SKU-${testId},100,5,1,New
"Item B",${targetCategory.slug},DUP-SKU-${testId},120,3,1,New`;

    const dupResult = await importProductsFromCsv({
      companyId: goldCompanyId,
      csvContent: duplicateCsv,
    });

    if (!dupResult.success && dupResult.errors.some((e) => e.message.includes('Duplicate barcode/SKU'))) {
      pass('CSV Duplicate Barcode Detection', 'Correctly identified duplicate SKU in batch');
    } else {
      fail('CSV Duplicate Barcode Detection', JSON.stringify(dupResult));
    }

    // 7. Test Password Reset Flow via HTTP API
    console.log('\n>>> Testing Password Reset Endpoints...');
    const baseUrl = 'http://127.0.0.1:3000';

    // 7a. Send OTP code
    const sendOtpRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_code', email: sellerEmail }),
    });
    const sendOtpData = await sendOtpRes.json();

    let devOtp = sendOtpData.devOtp;
    if (sendOtpRes.status === 200 && sendOtpData.success) {
      pass('Reset Password Send Code', `OTP dispatched (devOtp: ${devOtp})`);
    } else {
      fail('Reset Password Send Code', JSON.stringify(sendOtpData));
    }

    // 7b. Reset with old password
    const newPassword = 'NewlyChangedPassword987!';
    const resetOldRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset_with_old_password',
        email: sellerEmail,
        oldPassword: testPassword,
        newPassword,
      }),
    });
    const resetOldData = await resetOldRes.json();

    if (resetOldRes.status === 200 && resetOldData.success) {
      pass('Reset with Old Password', 'Successfully verified current password and updated to new password');
    } else {
      fail('Reset with Old Password', JSON.stringify(resetOldData));
    }

    // Verify login with new password
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword({
      email: sellerEmail,
      password: newPassword,
    });

    if (!loginErr && loginData?.user) {
      pass('Login with New Password', `Authenticated as ${loginData.user.id}`);
    } else {
      fail('Login with New Password', loginErr?.message);
    }

    // 7c. If devOtp is present, test verify_code_and_reset back to testPassword
    if (devOtp) {
      const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_code_and_reset',
          email: sellerEmail,
          code: devOtp,
          newPassword: testPassword,
        }),
      });
      const resetData = await resetRes.json();

      if (resetRes.status === 200 && resetData.success) {
        pass('Reset Password with Code', 'Password successfully updated via OTP');
      } else {
        fail('Reset Password with Code', JSON.stringify(resetData));
      }
    }

  } catch (err: any) {
    console.error('Test execution error:', err);
    fail('Test Script Execution', err.message);
  } finally {
    // Clean up
    console.log('\n>>> Cleaning up test users...');
    if (goldCompanyId) {
      await admin.from('products').delete().eq('company_id', goldCompanyId);
      await admin.from('companies').delete().eq('id', goldCompanyId);
    }
    if (bronzeCompanyId) {
      await admin.from('companies').delete().eq('id', bronzeCompanyId);
    }
    if (goldUserId) {
      await admin.auth.admin.deleteUser(goldUserId);
    }
    if (bronzeUserId) {
      await admin.auth.admin.deleteUser(bronzeUserId);
    }
    console.log('Cleanup completed.\n');
  }

  console.log(`========================================`);
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();

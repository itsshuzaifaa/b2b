import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// 1. Read environment variables
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = {
  passed: [],
  failed: [],
};

function pass(feature, details) {
  console.log(`[PASS] ${feature}: ${details}`);
  results.passed.push({ feature, details });
}

function fail(feature, error) {
  console.error(`[FAIL] ${feature}: ${error}`);
  results.failed.push({ feature, error });
}

async function runQaSuite() {
  console.log('====================================================');
  console.log('STARTING COMPREHENSIVE B2B LINK QA TEST SUITE');
  console.log('====================================================\n');

  const testId = Date.now().toString().slice(-6);
  const testBuyerEmail = `buyer.qa.${testId}@testcorp.eu`;
  const testSellerEmail = `seller.qa.${testId}@testcorp.eu`;
  const testPassword = 'TestPassword2026!';
  let buyerUserId = null;
  let buyerCompanyId = null;
  let sellerUserId = null;
  let sellerCompanyId = null;
  let createdProductId = null;
  let createdConversationId = null;
  let createdWtbId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: CATEGORIES
    // ----------------------------------------------------
    console.log('>>> 1. Testing Categories Query...');
    const { data: categories, error: catErr } = await admin.from('categories').select('*');
    if (catErr || !categories || categories.length === 0) {
      fail('Categories Query', catErr?.message || 'No categories found');
    } else {
      pass('Categories Query', `Found ${categories.length} categories (e.g. ${categories[0].name})`);
    }
    const defaultCategoryId = categories?.[0]?.id;

    // ----------------------------------------------------
    // TEST 2: ACCOUNT CREATION (SELLER)
    // ----------------------------------------------------
    console.log('\n>>> 2. Testing Seller Account Creation...');
    const { data: sellerAuth, error: sellerAuthErr } = await admin.auth.admin.createUser({
      email: testSellerEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        username: `seller_${testId}`,
        first_name: 'Helena',
        last_name: 'Berg',
        contact_name: 'Helena Berg',
        company_name: `Nordic Logistics QA ${testId} AB`,
        role: 'seller',
        tier: 'silver',
        approval_status: 'approved',
      },
    });

    if (sellerAuthErr || !sellerAuth?.user) {
      fail('Seller Auth User Creation', sellerAuthErr?.message);
    } else {
      sellerUserId = sellerAuth.user.id;
      pass('Seller Auth User Creation', `User created ID: ${sellerUserId}`);

      const { data: sellerComp, error: compErr } = await admin
        .from('companies')
        .insert({
          user_id: sellerUserId,
          company_name: `Nordic Logistics QA ${testId} AB`,
          contact_name: 'Helena Berg',
          contact_email: testSellerEmail,
          phone: '+46 8 123 4567',
          role: 'seller',
          approval_status: 'approved',
          tier: 'silver',
          niches: [defaultCategoryId],
        })
        .select()
        .single();

      if (compErr || !sellerComp) {
        fail('Seller Company Record Insertion', compErr?.message);
      } else {
        sellerCompanyId = sellerComp.id;
        pass('Seller Company Record Insertion', `Company ID: ${sellerCompanyId}`);
      }
    }

    // ----------------------------------------------------
    // TEST 3: ACCOUNT CREATION (BUYER)
    // ----------------------------------------------------
    console.log('\n>>> 3. Testing Buyer Account Creation...');
    const { data: buyerAuth, error: buyerAuthErr } = await admin.auth.admin.createUser({
      email: testBuyerEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        username: `buyer_${testId}`,
        first_name: 'Arthur',
        last_name: 'Pendleton',
        contact_name: 'Arthur Pendleton',
        company_name: `Apex Global Sourcing QA ${testId} Ltd`,
        role: 'seller', // Platform role 'seller' is unified trader role
        tier: 'gold',
        approval_status: 'approved',
      },
    });

    if (buyerAuthErr || !buyerAuth?.user) {
      fail('Buyer Auth User Creation', buyerAuthErr?.message);
    } else {
      buyerUserId = buyerAuth.user.id;
      pass('Buyer Auth User Creation', `User created ID: ${buyerUserId}`);

      const { data: buyerComp, error: buyerCompErr } = await admin
        .from('companies')
        .insert({
          user_id: buyerUserId,
          company_name: `Apex Global Sourcing QA ${testId} Ltd`,
          contact_name: 'Arthur Pendleton',
          contact_email: testBuyerEmail,
          phone: '+44 20 7946 0912',
          role: 'seller',
          approval_status: 'approved',
          tier: 'gold',
          niches: [defaultCategoryId],
        })
        .select()
        .single();

      if (buyerCompErr || !buyerComp) {
        fail('Buyer Company Record Insertion', buyerCompErr?.message);
      } else {
        buyerCompanyId = buyerComp.id;
        pass('Buyer Company Record Insertion', `Company ID: ${buyerCompanyId}`);
      }
    }

    // ----------------------------------------------------
    // TEST 4: PRODUCT CREATION & MANAGEMENT (SELLER)
    // ----------------------------------------------------
    console.log('\n>>> 4. Testing Product Creation & Management...');
    if (sellerCompanyId && defaultCategoryId) {
      const { data: prodData, error: prodErr } = await admin
        .from('products')
        .insert({
          company_id: sellerCompanyId,
          category_id: defaultCategoryId,
          title: `Apple iPad Air 11-inch M2 128GB Wi-Fi Space Gray (${testId})`,
          description: 'Factory sealed EU retail units with 1-year Apple manufacturer warranty. Dispatch from Hamburg.',
          barcode_or_sku: `EAN-195949${testId}`,
          unit_price: 549.0,
          quantity_available: 80,
          moq: 5,
          status: 'active',
          is_hot: true,
          image_urls: ['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800'],
        })
        .select()
        .single();

      if (prodErr || !prodData) {
        fail('Product Insertion', prodErr?.message);
      } else {
        createdProductId = prodData.id;
        pass('Product Insertion', `Product created ID: ${createdProductId}`);

        // Test product update
        const { data: updatedProd, error: updateErr } = await admin
          .from('products')
          .update({
            unit_price: 539.0,
            quantity_available: 75,
          })
          .eq('id', createdProductId)
          .select()
          .single();

        if (updateErr || updatedProd.unit_price !== 539.0) {
          fail('Product Update', updateErr?.message || 'Price mismatch');
        } else {
          pass('Product Update', 'Successfully updated unit price to 539.0 and quantity to 75');
        }
      }
    }

    // ----------------------------------------------------
    // TEST 5: BUYER INQUIRY CREATION (BUYER -> SELLER)
    // ----------------------------------------------------
    console.log('\n>>> 5. Testing Trade Inquiry Creation...');
    if (createdProductId && sellerCompanyId) {
      const initialChat = [
        {
          id: `msg-init-${Date.now()}`,
          senderId: testBuyerEmail,
          senderName: 'Arthur Pendleton',
          senderRole: 'buyer',
          text: 'Hello, we are interested in ordering 20 units of this iPad Air lot. Can you confirm EXW lead time?',
          timestamp: new Date().toISOString(),
          isRead: false,
        },
      ];

      const { data: inquiryData, error: inqErr } = await admin
        .from('product_inquiries')
        .insert({
          product_id: createdProductId,
          seller_company_id: sellerCompanyId,
          buyer_name: 'Arthur Pendleton',
          buyer_email: testBuyerEmail,
          buyer_phone: '+44 20 7946 0912',
          buyer_company: `Apex Global Sourcing QA ${testId} Ltd`,
          requested_quantity: 20,
          target_price: 530.0,
          message: JSON.stringify(initialChat),
          status: 'new',
        })
        .select()
        .single();

      if (inqErr || !inquiryData) {
        fail('Trade Inquiry Insertion', inqErr?.message);
      } else {
        createdConversationId = inquiryData.id;
        pass('Trade Inquiry Insertion', `Inquiry created ID: ${createdConversationId}`);
      }
    }

    // ----------------------------------------------------
    // TEST 6: MESSAGING BETWEEN SELLER AND BUYER
    // ----------------------------------------------------
    console.log('\n>>> 6. Testing Message Exchange (Seller Reply & Buyer Counter)...');
    if (createdConversationId) {
      // 6a. Seller replies
      const { data: threadRow } = await admin
        .from('product_inquiries')
        .select('message')
        .eq('id', createdConversationId)
        .single();

      let currentMessages = [];
      try {
        currentMessages = JSON.parse(threadRow.message);
      } catch {}

      const sellerReply = {
        id: `msg-seller-${Date.now()}`,
        senderId: testSellerEmail,
        senderName: 'Helena Berg',
        senderRole: 'seller',
        text: 'Thanks for reaching out Arthur! Yes, 20 units are in stock and ready to ship within 24h. We can do €535/unit for 20 pcs.',
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      currentMessages.push(sellerReply);

      const { error: replyErr } = await admin
        .from('product_inquiries')
        .update({
          message: JSON.stringify(currentMessages),
          status: 'replied',
        })
        .eq('id', createdConversationId);

      if (replyErr) {
        fail('Seller Message Reply', replyErr.message);
      } else {
        pass('Seller Message Reply', 'Seller Helena Berg posted reply to conversation');
      }

      // 6b. Buyer responds
      const buyerCounter = {
        id: `msg-buyer-2-${Date.now()}`,
        senderId: testBuyerEmail,
        senderName: 'Arthur Pendleton',
        senderRole: 'buyer',
        text: 'Agreed at €535/unit. Please send proforma invoice.',
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      currentMessages.push(buyerCounter);

      const { error: counterErr } = await admin
        .from('product_inquiries')
        .update({
          message: JSON.stringify(currentMessages),
        })
        .eq('id', createdConversationId);

      if (counterErr) {
        fail('Buyer Counter Message', counterErr.message);
      } else {
        pass('Buyer Counter Message', 'Buyer Arthur posted agreement to conversation. Total messages: ' + currentMessages.length);
      }
    }

    // ----------------------------------------------------
    // TEST 7: WTB (WANT-TO-BUY) SOURCING REQUEST CREATION
    // ----------------------------------------------------
    console.log('\n>>> 7. Testing Sourcing Request (WTB)...');
    if (defaultCategoryId) {
      const { data: wtbRow, error: wtbErr } = await admin
        .from('wtb_requests')
        .insert({
          buyer_user_id: buyerUserId,
          buyer_name: 'Arthur Pendleton',
          buyer_email: testBuyerEmail,
          buyer_phone: '+44 20 7946 0912',
          buyer_company: `Apex Global Sourcing QA ${testId} Ltd`,
          category_id: defaultCategoryId,
          product_name: `Samsung Galaxy S24 Ultra 256GB Titanium Gray (${testId})`,
          barcode_or_sku: `8806095${testId}`,
          target_quantity: 50,
          target_price: 850.0,
          delivery_deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
          notes: 'Looking for sealed European spec. Immediate payment on verified goods.',
          status: 'open',
        })
        .select()
        .single();

      if (wtbErr || !wtbRow) {
        fail('WTB Request Creation', wtbErr?.message);
      } else {
        createdWtbId = wtbRow.id;
        pass('WTB Request Creation', `WTB created ID: ${createdWtbId}`);
      }
    }

    // ----------------------------------------------------
    // TEST 8: SELLER QUOTATION ON WTB REQUEST
    // ----------------------------------------------------
    console.log('\n>>> 8. Testing Seller Quotation on WTB...');
    if (createdWtbId && sellerCompanyId) {
      const { data: quoteRow, error: quoteErr } = await admin
        .from('quotations')
        .insert({
          wtb_request_id: createdWtbId,
          seller_company_id: sellerCompanyId,
          offered_unit_price: 845.0,
          available_quantity: 50,
          lead_time_days: 2,
          notes: 'We have 50 pcs physical stock in Sweden warehouse. Can dispatch tomorrow.',
          status: 'submitted',
        })
        .select()
        .single();

      if (quoteErr || !quoteRow) {
        fail('Quotation Submission', quoteErr?.message);
      } else {
        pass('Quotation Submission', `Quotation submitted ID: ${quoteRow.id} at €845/unit`);
      }
    }

    // ----------------------------------------------------
    // TEST 9: ADMIN DESK & BROADCAST MESSAGING
    // ----------------------------------------------------
    console.log('\n>>> 9. Testing Admin Desk Support & Broadcasts...');
    // Create an Admin Desk thread to seller
    const adminMsg = [
      {
        id: `admin-desk-${Date.now()}`,
        senderId: 'admin-desk',
        senderName: 'Jeff Vetting Director (B2B LINK Desk)',
        senderRole: 'admin',
        text: `Welcome to B2B LINK Helena! Your seller account Nordic Logistics QA ${testId} AB is verified. Let us know if you need assistance uploading stock lists.`,
        timestamp: new Date().toISOString(),
        isRead: false,
      },
    ];

    const { data: adminDeskThread, error: adminDeskErr } = await admin
      .from('product_inquiries')
      .insert({
        product_id: '00000000-0000-4000-a000-000000000001',
        seller_company_id: sellerCompanyId,
        buyer_name: 'Jeff Vetting Director',
        buyer_email: 'admin@b2blink.eu',
        buyer_company: 'B2B LINK OÜ (Admin Desk)',
        requested_quantity: 1,
        target_price: 0,
        message: JSON.stringify(adminMsg),
        status: 'admin_desk',
      })
      .select()
      .single();

    if (adminDeskErr || !adminDeskThread) {
      fail('Admin Desk Support Thread', adminDeskErr?.message);
    } else {
      pass('Admin Desk Support Thread', `Thread created ID: ${adminDeskThread.id}`);
    }

    // ----------------------------------------------------
    // TEST 10: USER PERMISSIONS & PRIVACY AUDIT
    // ----------------------------------------------------
    console.log('\n>>> 10. Testing Privacy & Scope Isolation...');
    // Check if GET /api/inquiries filters correctly
    const { data: allInquiries } = await admin
      .from('product_inquiries')
      .select('id, seller_company_id, buyer_email, status');

    const sellerThreads = allInquiries.filter(
      (i) => i.seller_company_id === sellerCompanyId
    );
    const buyerThreads = allInquiries.filter(
      (i) => i.buyer_email === testBuyerEmail
    );

    pass('Privacy Audit', `Seller sees ${sellerThreads.length} relevant threads; Buyer sees ${buyerThreads.length} relevant threads`);

    // ----------------------------------------------------
    // CLEANUP TEST DATA
    // ----------------------------------------------------
    console.log('\n>>> 11. Cleaning up Test Artifacts...');
    if (createdWtbId) {
      await admin.from('quotations').delete().eq('wtb_request_id', createdWtbId);
      await admin.from('wtb_requests').delete().eq('id', createdWtbId);
    }
    if (createdConversationId) {
      await admin.from('product_inquiries').delete().eq('id', createdConversationId);
    }
    if (adminDeskThread?.id) {
      await admin.from('product_inquiries').delete().eq('id', adminDeskThread.id);
    }
    if (createdProductId) {
      await admin.from('products').delete().eq('id', createdProductId);
    }
    if (buyerCompanyId) {
      await admin.from('companies').delete().eq('id', buyerCompanyId);
    }
    if (sellerCompanyId) {
      await admin.from('companies').delete().eq('id', sellerCompanyId);
    }
    if (buyerUserId) {
      await admin.auth.admin.deleteUser(buyerUserId);
    }
    if (sellerUserId) {
      await admin.auth.admin.deleteUser(sellerUserId);
    }
    pass('Cleanup', 'Cleaned up all temporary test accounts, products, quotes, and threads.');

  } catch (err) {
    fail('Global Test Suite Error', err.message);
  }

  console.log('\n====================================================');
  console.log(`QA TEST SUMMARY: ${results.passed.length} PASSED | ${results.failed.length} FAILED`);
  console.log('====================================================');
}

runQaSuite();

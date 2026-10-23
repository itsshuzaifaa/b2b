import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';

const summary = {
  passed: [],
  failed: [],
};

function pass(name, details) {
  console.log(`✅ [PASS] ${name}: ${details}`);
  summary.passed.push({ name, details });
}

function fail(name, error) {
  console.error(`❌ [FAIL] ${name}: ${error}`);
  summary.failed.push({ name, error });
}

async function run() {
  console.log('====================================================');
  console.log('RUNNING LIVE HTTP END-TO-END TEST SUITE ON LOCALHOST:3000');
  console.log('====================================================\n');

  const stamp = Date.now().toString().slice(-6);
  const sellerUsername = `seller_${stamp}`;
  const sellerEmail = `seller.${stamp}@live-qa-nordic.eu`;
  const buyerUsername = `buyer_${stamp}`;
  const buyerEmail = `buyer.${stamp}@live-qa-apex.co.uk`;

  let createdSellerCompanyId = null;
  let createdProductId = null;
  let createdInquiryId = null;

  try {
    // 1. Check Reserved Username
    console.log('>>> 1. Testing check-username (Reserved)...');
    const resRes = await fetch(`${BASE_URL}/api/auth/check-username?username=admin`);
    const resJson = await resRes.json();
    if (resJson.available === false && resJson.reason?.includes('reserved')) {
      pass('Check Reserved Username', 'Correctly rejected reserved "admin" username');
    } else {
      fail('Check Reserved Username', JSON.stringify(resJson));
    }

    // 2. Check Available Username
    console.log('\n>>> 2. Testing check-username (Available)...');
    const availRes = await fetch(`${BASE_URL}/api/auth/check-username?username=${sellerUsername}`);
    const availJson = await availRes.json();
    if (availJson.available === true) {
      pass('Check Available Username', `Username "${sellerUsername}" is confirmed available`);
    } else {
      fail('Check Available Username', JSON.stringify(availJson));
    }

    // 3. Register Seller Account
    console.log('\n>>> 3. Testing POST /api/auth/register (Seller)...');
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password: 'LivePassword2026!',
        username: sellerUsername,
        firstName: 'Astrid',
        lastName: 'Lind',
        companyName: `Nordic Sound Distribution ${stamp} AB`,
        phone: '+46 8 555 1234',
        membershipTier: 'silver',
        selectedNiches: ['0e07e810-fb76-4431-ba0f-6d98d6be357c'],
      }),
    });
    const regJson = await regRes.json();
    if (regRes.ok && regJson.success) {
      createdSellerCompanyId = regJson.companyId;
      pass('Register Seller Account', `Registered ${sellerEmail} with company ID ${createdSellerCompanyId}`);
    } else {
      fail('Register Seller Account', JSON.stringify(regJson));
    }

    // 4. Lookup Username
    console.log('\n>>> 4. Testing POST /api/auth/lookup-username...');
    const lookupRes = await fetch(`${BASE_URL}/api/auth/lookup-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: sellerUsername }),
    });
    const lookupJson = await lookupRes.json();
    if (lookupRes.ok && lookupJson.email?.toLowerCase() === sellerEmail.toLowerCase()) {
      pass('Lookup Username', `Resolved username "${sellerUsername}" to "${sellerEmail}"`);
    } else {
      fail('Lookup Username', JSON.stringify(lookupJson));
    }

    // 5. Register Buyer Account
    console.log('\n>>> 5. Testing POST /api/auth/register (Buyer)...');
    const regBuyerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerEmail,
        password: 'LivePassword2026!',
        username: buyerUsername,
        firstName: 'George',
        lastName: 'Clark',
        companyName: `Apex Retailers UK ${stamp} Ltd`,
        phone: '+44 20 7946 0888',
        membershipTier: 'gold',
        selectedNiches: ['0e07e810-fb76-4431-ba0f-6d98d6be357c'],
      }),
    });
    const regBuyerJson = await regBuyerRes.json();
    if (regBuyerRes.ok && regBuyerJson.success) {
      pass('Register Buyer Account', `Registered buyer ${buyerEmail}`);
    } else {
      fail('Register Buyer Account', JSON.stringify(regBuyerJson));
    }

    // 6. Marketplace: Fetch Active Products
    console.log('\n>>> 6. Testing GET /api/products...');
    const prodListRes = await fetch(`${BASE_URL}/api/products`);
    const prodListJson = await prodListRes.json();
    if (prodListRes.ok && prodListJson.success && Array.isArray(prodListJson.products)) {
      pass('Fetch Marketplace Products', `Fetched ${prodListJson.products.length} live products`);
    } else {
      fail('Fetch Marketplace Products', JSON.stringify(prodListJson));
    }

    // 7. Add Product as Seller
    console.log('\n>>> 7. Testing POST /api/products (Create Product)...');
    const createProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: createdSellerCompanyId,
        title: `Sennheiser Momentum 4 Wireless Black (${stamp})`,
        description: 'New factory sealed EU wholesale inventory. Official 2-year warranty included.',
        barcodeOrSku: `EAN-404415${stamp}`,
        unitPrice: 229.0,
        quantityAvailable: 60,
        moq: 5,
        condition: 'New',
        isHot: true,
        images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800'],
      }),
    });
    const createProdJson = await createProdRes.json();
    if (createProdRes.ok && createProdJson.success && createProdJson.product?.id) {
      createdProductId = createProdJson.product.id;
      pass('Create Product', `Product created with ID: ${createdProductId} at €229.00`);
    } else {
      fail('Create Product', JSON.stringify(createProdJson));
    }

    // 8. Fetch Created Product Details
    console.log('\n>>> 8. Testing GET /api/products?id=...');
    const singleProdRes = await fetch(`${BASE_URL}/api/products?id=${createdProductId}`);
    const singleProdJson = await singleProdRes.json();
    if (singleProdRes.ok && singleProdJson.product?.id === createdProductId) {
      pass('Get Single Product', `Verified product details: ${singleProdJson.product.title}`);
    } else {
      fail('Get Single Product', JSON.stringify(singleProdJson));
    }

    // 9. Trade Inquiry: Buyer contacts Seller about the product
    console.log('\n>>> 9. Testing POST /api/inquiries (action: create_inquiry)...');
    const inquiryRes = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_inquiry',
        productId: createdProductId,
        sellerCompanyId: createdSellerCompanyId,
        buyerName: 'George Clark',
        buyerEmail: buyerEmail,
        buyerCompany: `Apex Retailers UK ${stamp} Ltd`,
        buyerPhone: '+44 20 7946 0888',
        requestedQuantity: 25,
        targetPrice: 220.0,
        initialMessage: `Good morning Astrid, we want to acquire 25 units of Sennheiser Momentum 4. Can you do €220 / unit for quick settlement?`,
      }),
    });
    const inquiryJson = await inquiryRes.json();
    if (inquiryRes.ok && inquiryJson.success && inquiryJson.conversation?.id) {
      createdInquiryId = inquiryJson.conversation.id;
      pass('Create Product Inquiry', `Trade inquiry thread opened with ID: ${createdInquiryId}`);
    } else {
      fail('Create Product Inquiry', JSON.stringify(inquiryJson));
    }

    // 10. Messaging: Seller Replies to Buyer
    console.log('\n>>> 10. Testing POST /api/inquiries (action: send_message by Seller)...');
    const sellerReplyRes = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_message',
        conversationId: createdInquiryId,
        message: {
          senderId: sellerEmail,
          senderName: 'Astrid Lind',
          senderRole: 'seller',
          text: 'Hi George, thank you for the inquiry. We can meet in the middle at €224 / unit for 25 units. We can dispatch on Monday.',
        },
      }),
    });
    const sellerReplyJson = await sellerReplyRes.json();
    if (sellerReplyRes.ok && sellerReplyJson.success) {
      pass('Seller Reply', 'Seller successfully sent message reply into conversation thread');
    } else {
      fail('Seller Reply', JSON.stringify(sellerReplyJson));
    }

    // 11. Messaging: Buyer Responds Back
    console.log('\n>>> 11. Testing POST /api/inquiries (action: send_message by Buyer)...');
    const buyerReplyRes = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_message',
        conversationId: createdInquiryId,
        message: {
          senderId: buyerEmail,
          senderName: 'George Clark',
          senderRole: 'buyer',
          text: 'Deal agreed at €224 / unit. Please issue the proforma invoice to accounts@apexretail.co.uk.',
        },
      }),
    });
    const buyerReplyJson = await buyerReplyRes.json();
    if (buyerReplyRes.ok && buyerReplyJson.success) {
      pass('Buyer Counter Reply', 'Buyer accepted counter-offer. Live chat verified bidirectional.');
    } else {
      fail('Buyer Counter Reply', JSON.stringify(buyerReplyJson));
    }

    // 12. Verification of Conversation Privacy for Seller
    console.log('\n>>> 12. Testing GET /api/inquiries (Seller Perspective)...');
    const sellerInqListRes = await fetch(`${BASE_URL}/api/inquiries?companyId=${createdSellerCompanyId}&role=seller`);
    const sellerInqListJson = await sellerInqListRes.json();
    if (sellerInqListRes.ok && sellerInqListJson.conversations?.some((c) => c.id === createdInquiryId)) {
      pass('Seller Inquiry Privacy View', `Seller views thread ${createdInquiryId} containing ${sellerInqListJson.conversations[0]?.messages?.length} messages`);
    } else {
      fail('Seller Inquiry Privacy View', JSON.stringify(sellerInqListJson));
    }

    // 13. Verification of Conversation Privacy for Buyer
    console.log('\n>>> 13. Testing GET /api/inquiries (Buyer Perspective)...');
    const buyerInqListRes = await fetch(`${BASE_URL}/api/inquiries?email=${encodeURIComponent(buyerEmail)}&role=buyer`);
    const buyerInqListJson = await buyerInqListRes.json();
    if (buyerInqListRes.ok && buyerInqListJson.conversations?.some((c) => c.id === createdInquiryId)) {
      pass('Buyer Inquiry Privacy View', `Buyer views thread ${createdInquiryId}`);
    } else {
      fail('Buyer Inquiry Privacy View', JSON.stringify(buyerInqListJson));
    }

    // 14. Admin Desk Support Thread
    console.log('\n>>> 14. Testing POST /api/inquiries (action: contact_admin)...');
    const contactAdminRes = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'contact_admin',
        sellerCompanyId: createdSellerCompanyId,
        contactName: 'Astrid Lind',
        contactEmail: sellerEmail,
        initialMessage: 'Requesting verification of our Swedish VAT registration document.',
      }),
    });
    const contactAdminJson = await contactAdminRes.json();
    if (contactAdminRes.ok && contactAdminJson.success && contactAdminJson.conversation?.id) {
      pass('Contact Admin Desk', `Admin Desk support thread opened ID: ${contactAdminJson.conversation.id}`);
    } else {
      fail('Contact Admin Desk', JSON.stringify(contactAdminJson));
    }

    // 15. Admin Direct Message to Seller
    console.log('\n>>> 15. Testing POST /api/inquiries (action: admin_direct_message)...');
    const adminDmRes = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'admin_direct_message',
        sellerCompanyId: createdSellerCompanyId,
        adminName: 'Jeff Vetting Director',
        text: 'Astrid, your Swedish VAT document has been verified. Welcome aboard B2B LINK!',
      }),
    });
    const adminDmJson = await adminDmRes.json();
    if (adminDmRes.ok && adminDmJson.success) {
      pass('Admin Direct Message', 'Admin successfully sent private notification to seller');
    } else {
      fail('Admin Direct Message', JSON.stringify(adminDmJson));
    }

    // 16. Admin Broadcast Creation
    console.log('\n>>> 16. Testing POST /api/inquiries (action: create_broadcast)...');
    const broadcastRes = await fetch(`${BASE_URL}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_broadcast',
        title: 'Platform Maintenance Notice',
        text: 'Scheduled routine server optimization tonight at 02:00 CET.',
        targetAudience: 'all',
      }),
    });
    const broadcastJson = await broadcastRes.json();
    if (broadcastRes.ok && broadcastJson.success) {
      pass('Platform Broadcast', 'Platform-wide broadcast created and registered in messaging store');
    } else {
      fail('Platform Broadcast', JSON.stringify(broadcastJson));
    }

    // 17. Activate Tier
    console.log('\n>>> 17. Testing POST /api/billing/activate-tier...');
    const tierRes = await fetch(`${BASE_URL}/api/billing/activate-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: createdSellerCompanyId,
        tier: 'gold',
        billingCycle: 'yearly',
      }),
    });
    const tierJson = await tierRes.json();
    if (tierRes.ok && tierJson.success) {
      pass('Activate Membership Tier', `Successfully upgraded ${createdSellerCompanyId} to GOLD tier`);
    } else {
      fail('Activate Membership Tier', JSON.stringify(tierJson));
    }

    // 18. Admin Accounts
    console.log('\n>>> 18. Testing GET /api/admin/accounts...');
    const adminAccRes = await fetch(`${BASE_URL}/api/admin/accounts`);
    const adminAccJson = await adminAccRes.json();
    if (adminAccRes.ok && adminAccJson.success && Array.isArray(adminAccJson.accounts)) {
      pass('Admin Accounts Management', `Retrieved ${adminAccJson.accounts.length} member accounts for vetting desk`);
    } else {
      fail('Admin Accounts Management', JSON.stringify(adminAccJson));
    }

    // 19. Public Contact Form Submission
    console.log('\n>>> 19. Testing POST /api/contact...');
    const contactRes = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'David Miller',
        email: 'david@europetrade.com',
        phone: '+49 30 123456',
        subject: 'Partnership Inquiry',
        message: 'Interested in API enterprise integration with our ERP.',
      }),
    });
    const contactJson = await contactRes.json();
    if (contactRes.ok && contactJson.success) {
      pass('Contact Form Submission', 'Contact form message received and recorded');
    } else {
      fail('Contact Form Submission', JSON.stringify(contactJson));
    }

    // 20. Clean up created product
    console.log('\n>>> 20. Testing DELETE /api/products...');
    if (createdProductId) {
      const delProdRes = await fetch(`${BASE_URL}/api/products?id=${createdProductId}`, {
        method: 'DELETE',
      });
      const delProdJson = await delProdRes.json();
      if (delProdRes.ok && delProdJson.success) {
        pass('Delete Product', `Successfully removed product ${createdProductId}`);
      } else {
        fail('Delete Product', JSON.stringify(delProdJson));
      }
    }

  } catch (err) {
    fail('Live HTTP Suite Global Error', err.message);
  }

  console.log('\n====================================================');
  console.log(`LIVE HTTP TEST RESULTS: ${summary.passed.length} PASSED | ${summary.failed.length} FAILED`);
  console.log('====================================================');
}

run();

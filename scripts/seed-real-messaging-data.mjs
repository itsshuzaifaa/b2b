import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('=== SEEDING REAL B2B LINK DATA & THREE CORE ACCOUNTS ===');

  // 1. Fetch Categories
  const { data: categories, error: catErr } = await supabase.from('categories').select('*');
  if (catErr || !categories?.length) {
    console.error('Failed to fetch categories:', catErr);
    process.exit(1);
  }
  const electronicsCat = categories.find((c) => c.slug === 'electronics') || categories[0];
  const beautyCat = categories.find((c) => c.slug === 'health-beauty') || categories[1] || categories[0];
  const homeCat = categories.find((c) => c.slug === 'home-kitchen') || categories[2] || categories[0];

  // 2. Provision Three Core Accounts: Admin, Seller, Buyer
  const accountsToProvision = [
    {
      email: 'admin@b2blink.eu',
      password: 'AdminPassword2026!',
      companyName: 'B2B LINK OÜ',
      contactName: 'Jeff Vetting Director',
      role: 'admin',
      approvalStatus: 'approved',
      tier: 'gold',
      companyNumber: 'EE-10294821',
      vatNumber: 'EE102948210',
      phone: '+372 612 3456',
    },
    {
      email: 'seller@nordictech.eu',
      password: 'SellerPassword2026!',
      companyName: 'Nordic Electro Wholesale Ltd',
      contactName: 'Lars Lindqvist',
      role: 'seller',
      approvalStatus: 'approved',
      tier: 'gold',
      companyNumber: '556123-4567',
      vatNumber: 'SE556123456701',
      phone: '+46 8 123 4567',
    },
    {
      email: 'buyer@apexretail.co.uk',
      password: 'BuyerPassword2026!',
      companyName: 'Apex Retail Distribution UK Ltd',
      contactName: 'Marcus Wright',
      role: 'buyer',
      approvalStatus: 'approved',
      tier: 'silver',
      companyNumber: '12849201',
      vatNumber: 'GB982103948',
      phone: '+44 7911 123456',
    },
  ];

  const companyMap = {};

  for (const acc of accountsToProvision) {
    console.log(`\nConfiguring ${acc.role.toUpperCase()} Account: ${acc.email}`);

    // Auth user check / create
    const { data: userList } = await supabase.auth.admin.listUsers();
    let user = userList?.users?.find((u) => u.email === acc.email);

    if (user) {
      console.log(`  Updating auth user ${user.id}...`);
      await supabase.auth.admin.updateUserById(user.id, {
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          contact_name: acc.contactName,
          company_name: acc.companyName,
          role: acc.role,
        },
      });
    } else {
      console.log(`  Creating new auth user...`);
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          contact_name: acc.contactName,
          company_name: acc.companyName,
          role: acc.role,
        },
      });
      if (createErr) {
        console.error(`  Auth create error for ${acc.email}:`, createErr.message);
      } else {
        user = created.user;
      }
    }

    // Company table check / update
    const { data: existingComp } = await supabase
      .from('companies')
      .select('*')
      .eq('contact_email', acc.email)
      .maybeSingle();

    if (existingComp) {
      console.log(`  Updating existing company record ${existingComp.id}...`);
      const { data: updatedComp } = await supabase
        .from('companies')
        .update({
          user_id: user?.id || existingComp.user_id,
          company_name: acc.companyName,
          contact_name: acc.contactName,
          role: acc.role,
          approval_status: acc.approvalStatus,
          tier: acc.tier,
          company_number: acc.companyNumber,
          vat_number: acc.vatNumber,
          phone: acc.phone,
          niches: [electronicsCat.id],
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingComp.id)
        .select()
        .single();
      companyMap[acc.role] = updatedComp || existingComp;
    } else {
      console.log(`  Inserting company record...`);
      const { data: insertedComp, error: insertErr } = await supabase
        .from('companies')
        .insert({
          user_id: user?.id,
          company_name: acc.companyName,
          contact_name: acc.contactName,
          contact_email: acc.email,
          role: acc.role,
          approval_status: acc.approvalStatus,
          tier: acc.tier,
          company_number: acc.companyNumber,
          vat_number: acc.vatNumber,
          phone: acc.phone,
          niches: [electronicsCat.id],
        })
        .select()
        .single();
      if (insertErr) {
        console.error(`  Company insert error:`, insertErr.message);
      } else {
        companyMap[acc.role] = insertedComp;
      }
    }
  }

  const adminComp = companyMap['admin'];
  const sellerComp = companyMap['seller'];
  const buyerComp = companyMap['buyer'];

  console.log('\nResolved Companies:');
  console.log('Admin:', adminComp?.id, adminComp?.company_name);
  console.log('Seller:', sellerComp?.id, sellerComp?.company_name);
  console.log('Buyer:', buyerComp?.id, buyerComp?.company_name);

  // 3. Clean up and insert Real Products for Seller
  console.log('\nCleaning existing products and inserting real wholesale lots...');
  // Delete existing inquiries first to avoid foreign key conflicts
  await supabase.from('product_inquiries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const realProducts = [
    {
      company_id: sellerComp.id,
      category_id: electronicsCat.id,
      title: 'Sony WH-1000XM5 Wireless Headphones (Sealed EU Stock)',
      description: 'Brand new, factory-sealed master cartons with official Sony European 2-year warranty. Full CE certification and EAN barcodes on outer cartons. Available for immediate pickup or DDP delivery across Europe.',
      barcode_or_sku: '5013493820194',
      quantity_available: 240,
      moq: 20,
      unit_price: 185.0,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
      is_hot: true,
      status: 'active',
    },
    {
      company_id: sellerComp.id,
      category_id: electronicsCat.id,
      title: 'Apple iPhone 15 Pro Max 256GB Natural Titanium (EU Model)',
      description: 'Factory unlocked pristine retail inventory. Clean IMEIs, verified Apple authorized distributor origin. Physical stock located in bonded warehouse. Reverse-charge VAT compliant for EU VAT-registered companies.',
      barcode_or_sku: '0195949038201',
      quantity_available: 85,
      moq: 10,
      unit_price: 890.0,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800'],
      is_hot: true,
      status: 'active',
    },
    {
      company_id: sellerComp.id,
      category_id: beautyCat.id,
      title: 'Dyson Supersonic Origin Hair Dryer (EU 2-Pin Commercial Lot)',
      description: 'Official wholesale batch with European 2-pin power plugs. Complete serial number traceability and manufacturer seals intact. Palletized and shrink-wrapped.',
      barcode_or_sku: '5025155074218',
      quantity_available: 150,
      moq: 15,
      unit_price: 225.0,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800'],
      is_hot: false,
      status: 'active',
    },
    {
      company_id: sellerComp.id,
      category_id: homeCat.id,
      title: "De'Longhi Magnifica S Fully Automatic Coffee Machine",
      description: 'Original European specifications, Model ECAM22.110.B. Sealed retail packaging with multi-language user manuals. Export clearance ready.',
      barcode_or_sku: '8004399325059',
      quantity_available: 120,
      moq: 12,
      unit_price: 265.0,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800'],
      is_hot: false,
      status: 'active',
    },
  ];

  const { data: insertedProducts, error: prodInsertErr } = await supabase
    .from('products')
    .insert(realProducts)
    .select();

  if (prodInsertErr || !insertedProducts?.length) {
    console.error('Failed to insert products:', prodInsertErr);
    process.exit(1);
  }

  console.log(`Successfully inserted ${insertedProducts.length} real wholesale products:`);
  insertedProducts.forEach((p) => console.log(`  - [${p.id}] ${p.title} (£${p.unit_price})`));

  const prodHeadphones = insertedProducts[0];
  const prodPhones = insertedProducts[1];

  // 4. Insert Real Live Inquiry Conversations into product_inquiries
  console.log('\nCreating realistic live wholesale inquiries in Supabase...');

  // Thread 1: Buyer (Marcus / Apex) inquiring on Sony Headphones to Seller (Lars / Nordic Electro)
  const thread1Messages = [
    {
      id: `msg-sony-1`,
      senderRole: 'buyer',
      senderId: buyerComp.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      text: 'Hi Lars, we require 40 units of the Sony WH-1000XM5 lot for our distribution depot in Birmingham. Can you confirm EXW lead time and EU declaration of conformity docs?',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: `msg-sony-2`,
      senderRole: 'seller',
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      text: 'Hello Marcus, good to connect. Yes, all 40 units are physically on pallets at our Malmö hub. Full CE docs and serial sheets are ready. We can release for collection within 48h of wire settlement.',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: `msg-sony-3`,
      senderRole: 'buyer',
      senderId: buyerComp.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      text: 'Excellent. If we take 50 units instead, can you do £180.00 per unit flat? Ready to issue purchase order today.',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: `msg-sony-4`,
      senderRole: 'seller',
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      text: 'Agreed on 50 units @ £180.00/unit. Send your PO number and forwarding agent details, and I will generate the proforma invoice with 0% platform fee.',
      timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
  ];

  // Thread 2: Buyer (Marcus) inquiring on iPhone 15 Pro Max to Seller (Lars)
  const thread2Messages = [
    {
      id: `msg-apple-1`,
      senderRole: 'buyer',
      senderId: buyerComp.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      text: 'Hello Lars, we are interested in 15 units of the iPhone 15 Pro Max 256GB Titanium. Do you support reverse-charge VAT invoicing for UK/EU trade?',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: `msg-apple-2`,
      senderRole: 'seller',
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      text: 'Hi Marcus. Absolutely, we provide zero-rated intra-community invoices for validated VAT numbers. All 15 units are sealed European spec.',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
  ];

  // Thread 3: Admin (Jeff Vetting Director) Desk Thread with Seller (Lars)
  const thread3Messages = [
    {
      id: `msg-admin-1`,
      senderRole: 'admin',
      senderId: adminComp.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      text: 'Hello Lars, welcome to B2B LINK OÜ. Your commercial seller account and corporate registration have been verified and approved.',
      timestamp: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    },
    {
      id: `msg-admin-2`,
      senderRole: 'seller',
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      text: 'Thank you Jeff. Our four master lots are live. We appreciate the 0% transaction fee model.',
      timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    },
    {
      id: `msg-admin-3`,
      senderRole: 'admin',
      senderId: adminComp.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      text: 'Outstanding. If you need any assistance with high-volume lots or buyer verification on escrow, our desk is directly available here 24/7.',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
  ];

  const inquiriesToInsert = [
    {
      product_id: prodHeadphones.id,
      seller_company_id: sellerComp.id,
      buyer_company: buyerComp.company_name,
      buyer_name: buyerComp.contact_name,
      buyer_email: buyerComp.contact_email,
      buyer_phone: buyerComp.phone,
      requested_quantity: 50,
      target_price: 180.0,
      message: JSON.stringify(thread1Messages),
      status: 'negotiating',
      created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      product_id: prodPhones.id,
      seller_company_id: sellerComp.id,
      buyer_company: buyerComp.company_name,
      buyer_name: buyerComp.contact_name,
      buyer_email: buyerComp.contact_email,
      buyer_phone: buyerComp.phone,
      requested_quantity: 15,
      target_price: 890.0,
      message: JSON.stringify(thread2Messages),
      status: 'new',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      product_id: prodHeadphones.id,
      seller_company_id: sellerComp.id,
      buyer_company: adminComp.company_name,
      buyer_name: adminComp.contact_name,
      buyer_email: adminComp.contact_email,
      buyer_phone: adminComp.phone,
      requested_quantity: 1,
      target_price: 185.0,
      message: JSON.stringify(thread3Messages),
      status: 'compliance_desk',
      created_at: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    },
  ];

  const { data: insertedInquiries, error: inqErr } = await supabase
    .from('product_inquiries')
    .insert(inquiriesToInsert)
    .select();

  if (inqErr || !insertedInquiries?.length) {
    console.error('Failed to insert inquiries:', inqErr);
    process.exit(1);
  }

  console.log(`Successfully created ${insertedInquiries.length} live inquiry threads in Supabase.`);
  console.log('\n=== SETUP COMPLETE ===');
}

run().catch(console.error);

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

async function seedCleanLiveMessaging() {
  console.log('=== FEEDING CLEAN LIVE MESSAGING DATA INTO SUPABASE ===');

  // 1. Resolve Companies
  const { data: companies, error: compErr } = await supabase.from('companies').select('*');
  if (compErr || !companies?.length) {
    console.error('Error fetching companies:', compErr);
    process.exit(1);
  }

  const adminComp = companies.find((c) => c.role === 'admin' || c.contact_email === 'admin@b2blink.eu') || companies[0];
  const sellerComp = companies.find((c) => c.role === 'seller' || c.contact_email === 'seller@nordictech.eu') || companies.find((c) => c.role === 'seller') || companies[0];
  const buyerComp = companies.find((c) => c.role === 'buyer' || c.contact_email === 'buyer@apexretail.co.uk') || companies.find((c) => c.role === 'buyer') || companies[0];

  console.log(`Resolved Core Companies:`);
  console.log(`- Admin: ${adminComp.id} (${adminComp.company_name})`);
  console.log(`- Seller: ${sellerComp.id} (${sellerComp.company_name})`);
  console.log(`- Buyer: ${buyerComp.id} (${buyerComp.company_name})`);

  // 2. Resolve Products
  const { data: products, error: prodErr } = await supabase.from('products').select('*');
  if (prodErr || !products?.length) {
    console.error('Error fetching products:', prodErr);
    process.exit(1);
  }

  const prodSony = products.find((p) => p.title.toLowerCase().includes('sony')) || products[0];
  const prodApple = products.find((p) => p.title.toLowerCase().includes('apple') || p.title.toLowerCase().includes('iphone')) || products[1] || products[0];

  console.log(`Resolved Wholesale Products:`);
  console.log(`- Sony Lot: ${prodSony.id} ("${prodSony.title}")`);
  console.log(`- Apple Lot: ${prodApple.id} ("${prodApple.title}")`);

  // 3. Clear old sample inquiry records
  console.log('Clearing existing product_inquiries to ensure fresh live data...');
  const { error: delErr } = await supabase
    .from('product_inquiries')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (delErr) {
    console.warn('Delete warning:', delErr.message);
  }

  const now = Date.now();

  // THREAD 1: Buyer (Marcus / Apex) <-> Seller (Lars / Nordic Electro) - SONY HEADPHONES
  const thread1Messages = [
    {
      id: `msg-sony-1`,
      senderId: buyerComp.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      senderRole: 'buyer',
      text: 'Hi Lars, we require 40 units of the Sony WH-1000XM5 lot for our distribution depot in Birmingham. Can you confirm EXW lead time and EU declaration of conformity docs?',
      timestamp: new Date(now - 1000 * 60 * 180).toISOString(),
      isRead: true,
    },
    {
      id: `msg-sony-2`,
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      senderRole: 'seller',
      text: 'Hello Marcus, good to connect. Yes, all 40 units are physically on pallets at our Malmö hub. Full CE docs and serial sheets are ready. We can release for collection within 48h of wire settlement.',
      timestamp: new Date(now - 1000 * 60 * 120).toISOString(),
      isRead: true,
    },
    {
      id: `msg-sony-3`,
      senderId: buyerComp.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      senderRole: 'buyer',
      text: 'Excellent. If we take 50 units instead, can you do £180.00 per unit flat? Ready to issue purchase order today.',
      timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
      isRead: true,
    },
    {
      id: `msg-sony-4`,
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      senderRole: 'seller',
      text: 'Agreed on 50 units @ £180.00/unit. Send your PO number and forwarding agent details, and I will generate the proforma invoice with 0% platform fee.',
      timestamp: new Date(now - 1000 * 60 * 10).toISOString(),
      isRead: false,
    },
  ];

  // THREAD 2: Buyer (Marcus / Apex) <-> Seller (Lars / Nordic Electro) - IPHONE 15 PRO MAX
  const thread2Messages = [
    {
      id: `msg-apple-1`,
      senderId: buyerComp.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      senderRole: 'buyer',
      text: 'Hello Lars, we are interested in 15 units of the iPhone 15 Pro Max 256GB Titanium lot. Do you support reverse-charge VAT invoicing for validated EU/UK companies?',
      timestamp: new Date(now - 1000 * 60 * 30).toISOString(),
      isRead: true,
    },
    {
      id: `msg-apple-2`,
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      senderRole: 'seller',
      text: 'Hi Marcus. Absolutely, we provide zero-rated intra-community invoices for validated VAT numbers. All 15 units are sealed European spec with clean IMEIs.',
      timestamp: new Date(now - 1000 * 60 * 8).toISOString(),
      isRead: false,
    },
  ];

  // THREAD 3: Seller (Lars / Nordic Electro) <-> Admin (Jeff / B2B LINK Desk) - DIRECT SUPPORT & VETTING
  const thread3Messages = [
    {
      id: `msg-admin-1`,
      senderId: adminComp.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      senderRole: 'admin',
      text: 'Hello Lars, welcome to B2B LINK OÜ. Your commercial seller account and European corporate registration (SE556123456701) have been verified and approved.',
      timestamp: new Date(now - 1000 * 60 * 600).toISOString(),
      isRead: true,
    },
    {
      id: `msg-admin-2`,
      senderId: sellerComp.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      senderRole: 'seller',
      text: 'Thank you Jeff. Our master stock lots are live on the European marketplace. We appreciate the transparent 0% transaction commission structure.',
      timestamp: new Date(now - 1000 * 60 * 360).toISOString(),
      isRead: true,
    },
    {
      id: `msg-admin-3`,
      senderId: adminComp.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      senderRole: 'admin',
      text: 'Outstanding. If you need any assistance with high-volume pallet logistics, buyer escrow verification, or custom proformas, our desk is directly available here 24/7.',
      timestamp: new Date(now - 1000 * 60 * 25).toISOString(),
      isRead: false,
    },
  ];

  // THREAD 4: Admin Broadcast to All Sellers - PLATFORM ANNOUNCEMENT
  const thread4Messages = [
    {
      id: `msg-broadcast-1`,
      senderId: adminComp.id,
      senderName: 'B2B LINK Platform Desk (Broadcast)',
      senderRole: 'admin',
      text: '📢 OFFICIAL BROADCAST: Welcome to the B2B LINK Wholesale Network. In-app real-time messaging is now active across all buyer and seller accounts. Zero platform commission applies on all direct trade orders.',
      timestamp: new Date(now - 1000 * 60 * 5).toISOString(),
      isRead: false,
      isBroadcast: true,
    },
  ];

  const liveInquiries = [
    {
      product_id: prodSony.id,
      seller_company_id: sellerComp.id,
      buyer_company: buyerComp.company_name,
      buyer_name: buyerComp.contact_name,
      buyer_email: buyerComp.contact_email,
      buyer_phone: buyerComp.phone,
      requested_quantity: 50,
      target_price: 180.0,
      message: JSON.stringify(thread1Messages),
      status: 'negotiating',
      created_at: new Date(now - 1000 * 60 * 180).toISOString(),
    },
    {
      product_id: prodApple.id,
      seller_company_id: sellerComp.id,
      buyer_company: buyerComp.company_name,
      buyer_name: buyerComp.contact_name,
      buyer_email: buyerComp.contact_email,
      buyer_phone: buyerComp.phone,
      requested_quantity: 15,
      target_price: 890.0,
      message: JSON.stringify(thread2Messages),
      status: 'new',
      created_at: new Date(now - 1000 * 60 * 30).toISOString(),
    },
    {
      product_id: prodSony.id,
      seller_company_id: sellerComp.id,
      buyer_company: 'B2B LINK OÜ (Admin Desk)',
      buyer_name: 'Jeff Vetting Director',
      buyer_email: adminComp.contact_email || 'admin@b2blink.eu',
      buyer_phone: adminComp.phone || '+372 612 3456',
      requested_quantity: 1,
      target_price: 185.0,
      message: JSON.stringify(thread3Messages),
      status: 'admin_desk',
      created_at: new Date(now - 1000 * 60 * 600).toISOString(),
    },
    {
      product_id: prodSony.id,
      seller_company_id: sellerComp.id,
      buyer_company: 'B2B LINK OÜ (Broadcast Announcement)',
      buyer_name: 'Platform Operations',
      buyer_email: 'broadcast@b2blink.eu',
      buyer_phone: '+372 612 3456',
      requested_quantity: 1,
      target_price: 0,
      message: JSON.stringify(thread4Messages),
      status: 'broadcast',
      created_at: new Date(now - 1000 * 60 * 5).toISOString(),
    },
  ];

  const { data: inserted, error: insertErr } = await supabase
    .from('product_inquiries')
    .insert(liveInquiries)
    .select();

  if (insertErr || !inserted?.length) {
    console.error('Failed to insert live inquiries:', insertErr);
    process.exit(1);
  }

  console.log(`\nSuccessfully created ${inserted.length} clean live conversation threads in Supabase:`);
  inserted.forEach((inq) => {
    console.log(`- ID: ${inq.id} | Status: ${inq.status} | Buyer/Party: ${inq.buyer_company}`);
  });

  console.log('\n=== LIVE MESSAGING DATA SUCCESSFULLY FED INTO SUPABASE ===');
}

seedCleanLiveMessaging().catch(console.error);

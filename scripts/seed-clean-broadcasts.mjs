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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('--- REFRESHING SUPABASE MESSAGING DATA ---');

  // 1. Fetch companies
  const { data: companies } = await supabase.from('companies').select('*');
  const admin = companies.find((c) => c.role === 'admin') || companies[0];
  const apexSeller = companies.find((c) => c.company_name?.toLowerCase().includes('apex wholesale')) || companies[0];
  const nordicSeller = companies.find((c) => c.company_name?.toLowerCase().includes('nordic')) || companies[1];
  const ukBuyer = companies.find((c) => c.role === 'buyer') || companies[2];

  console.log('Admin:', admin.company_name, admin.id);
  console.log('Apex Seller:', apexSeller.company_name, apexSeller.id);
  console.log('Nordic Seller:', nordicSeller.company_name, nordicSeller.id);
  console.log('UK Buyer:', ukBuyer.company_name, ukBuyer.id);

  // 2. Fetch products
  const { data: products } = await supabase.from('products').select('*');
  const prodSony = products.find((p) => p.title.toLowerCase().includes('sony')) || products[0];
  const prodApple = products.find((p) => p.title.toLowerCase().includes('apple')) || products[1];

  // 3. Clear existing inquiries
  const { error: delErr } = await supabase.from('product_inquiries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error('Delete error:', delErr);
  } else {
    console.log('Cleared old inquiries successfully.');
  }

  // 4. Create EXACTLY ONE Seller Broadcast from Jeff
  // Look like a personal message from Jeff to the seller
  const sellerBroadcastMsg = [
    {
      id: 'msg-broadcast-seller-1',
      senderId: admin.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      senderRole: 'admin',
      text: 'Hi there, welcome to the European Wholesale Network. All your inventory listings are now synced with zero transaction commissions. Our desk is on standby if you need cross-border VAT or pallet freight support.',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      isRead: false,
      isBroadcast: true,
      targetAudience: 'seller',
    },
  ];

  const { data: bSeller, error: errBSeller } = await supabase.from('product_inquiries').insert({
    id: '7f2dad1d-cb2e-44ee-a265-30c4b6053a37',
    product_id: prodSony.id,
    seller_company_id: apexSeller.id,
    buyer_name: 'Jeff Vetting Director',
    buyer_email: 'admin@b2blink.eu',
    buyer_company: 'B2B LINK OÜ (Admin Desk)',
    requested_quantity: 1,
    target_price: 1,
    message: JSON.stringify(sellerBroadcastMsg),
    status: 'broadcast_seller',
  }).select();

  console.log('Created Seller Broadcast:', bSeller ? 'OK' : errBSeller);

  // 5. Create EXACTLY ONE Buyer Broadcast from Jeff
  const buyerBroadcastMsg = [
    {
      id: 'msg-broadcast-buyer-1',
      senderId: admin.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      senderRole: 'admin',
      text: 'Hello Marcus, fresh European electronics and personal care stock lots with verified CE documentation have just arrived. Fast direct inquiries with 0% buyer commission are now live.',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      isRead: false,
      isBroadcast: true,
      targetAudience: 'buyer',
    },
  ];

  const { data: bBuyer, error: errBBuyer } = await supabase.from('product_inquiries').insert({
    id: '8a1dad1d-cb2e-44ee-a265-30c4b6053a48',
    product_id: prodSony.id,
    seller_company_id: apexSeller.id,
    buyer_name: 'Jeff Vetting Director',
    buyer_email: 'admin@b2blink.eu',
    buyer_company: 'B2B LINK OÜ (Admin Desk)',
    requested_quantity: 1,
    target_price: 1,
    message: JSON.stringify(buyerBroadcastMsg),
    status: 'broadcast_buyer',
  }).select();

  console.log('Created Buyer Broadcast:', bBuyer ? 'OK' : errBBuyer);

  // 6. Create Direct Thread: Seller Apex Wholesale <-> Admin Desk (Jeff)
  const adminDeskMsg = [
    {
      id: 'msg-apex-admin-1',
      senderId: admin.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      senderRole: 'admin',
      text: 'Hello Huzaifa, your commercial seller account for Apex Wholesale is fully approved and active. You can list products and receive direct inquiries from verified UK and EU buyers.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      isRead: true,
      isBroadcast: false,
    },
    {
      id: 'msg-apex-admin-2',
      senderId: apexSeller.id,
      senderName: 'Huzaifa Faisal (Apex Wholesale)',
      senderRole: 'seller',
      text: 'Thank you Jeff. We are getting our stock lots ready for upload.',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      isRead: true,
      isBroadcast: false,
    },
    {
      id: 'msg-apex-admin-3',
      senderId: admin.id,
      senderName: 'Jeff Vetting Director (B2B LINK Desk)',
      senderRole: 'admin',
      text: 'Excellent. Let me know if you need any assistance with reverse-charge VAT validation or custom proforma invoices.',
      timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      isRead: false,
      isBroadcast: false,
    },
  ];

  await supabase.from('product_inquiries').insert({
    id: '631fdb21-731d-4888-b863-fc36bbc44fe0',
    product_id: prodSony.id,
    seller_company_id: apexSeller.id,
    buyer_name: 'Jeff Vetting Director',
    buyer_email: 'admin@b2blink.eu',
    buyer_company: 'B2B LINK OÜ (Admin Desk)',
    requested_quantity: 1,
    target_price: 1,
    message: JSON.stringify(adminDeskMsg),
    status: 'admin_desk',
  });

  // 7. Create Trade Inquiry: Buyer Marcus Wright -> Seller Nordic Electro (Lars Lindqvist) on Sony Headphones
  const tradeMsgSony = [
    {
      id: 'msg-sony-1',
      senderId: ukBuyer.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      senderRole: 'buyer',
      text: 'Hi Lars, we require 40 units of the Sony WH-1000XM5 lot for our distribution depot in Birmingham. Can you confirm EXW lead time?',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      isRead: true,
    },
    {
      id: 'msg-sony-2',
      senderId: nordicSeller.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      senderRole: 'seller',
      text: 'Hello Marcus, good to connect. Yes, all 40 units are physically on pallets at our Malmö hub with full CE docs ready for collection.',
      timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      isRead: true,
    },
    {
      id: 'msg-sony-3',
      senderId: ukBuyer.id,
      senderName: 'Marcus Wright (Apex Retail UK)',
      senderRole: 'buyer',
      text: 'If we take 50 units instead, can you do £180.00/unit flat? Ready to issue purchase order today.',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      isRead: true,
    },
    {
      id: 'msg-sony-4',
      senderId: nordicSeller.id,
      senderName: 'Lars Lindqvist (Nordic Electro)',
      senderRole: 'seller',
      text: 'Agreed on 50 units @ £180.00/unit. Send your forwarding agent details and we will release proforma.',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      isRead: false,
    },
  ];

  await supabase.from('product_inquiries').insert({
    id: '9f4a8300-a769-4f04-babf-0f8e720d5d91',
    product_id: prodSony.id,
    seller_company_id: nordicSeller.id,
    buyer_name: 'Marcus Wright',
    buyer_email: 'buyer@apexretail.co.uk',
    buyer_company: 'Apex Retail Distribution UK Ltd',
    requested_quantity: 50,
    target_price: 180,
    message: JSON.stringify(tradeMsgSony),
    status: 'negotiating',
  });

  console.log('Seeded clean database records!');
}

main();

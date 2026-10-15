import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local
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
  console.log('=== SEEDING 8 LIVE MARKETPLACE PRODUCTS & VERIFIED SELLERS ===');

  // 1. Fetch categories
  const { data: categories, error: catErr } = await supabase.from('categories').select('*');
  if (catErr || !categories?.length) {
    console.error('Failed to fetch categories:', catErr);
    process.exit(1);
  }

  const electronics = categories.find((c) => c.slug === 'electronics') || categories[0];
  const beauty = categories.find((c) => c.slug === 'health-beauty') || categories[1];
  const home = categories.find((c) => c.slug === 'home-kitchen') || categories[2];

  // 2. Define the verified European sellers
  const verifiedSellers = [
    {
      id: 'a1111111-1111-4000-8000-000000000001',
      company_name: 'Northgate Trading GmbH',
      contact_name: 'Helena Vogel',
      contact_email: 'sales@northgatetrading.de',
      role: 'seller',
      approval_status: 'approved',
      tier: 'gold',
      company_number: 'HRB-89210',
      vat_number: 'DE318921045',
      phone: '+49 40 8291029',
      niches: [electronics.id],
    },
    {
      id: 'a2222222-2222-4000-8000-000000000002',
      company_name: 'Lumiere Beauty Ltd',
      contact_name: 'Camille Laurent',
      contact_email: 'contact@lumierebeauty.fr',
      role: 'seller',
      approval_status: 'approved',
      tier: 'gold',
      company_number: 'FR-894102941',
      vat_number: 'FR89410294101',
      phone: '+33 1 42 68 55 00',
      niches: [beauty.id],
    },
    {
      id: 'a3333333-3333-4000-8000-000000000003',
      company_name: 'Hearth & Co Commercial Dist.',
      contact_name: 'Stefan Becker',
      contact_email: 'b2b@hearthandco.de',
      role: 'seller',
      approval_status: 'approved',
      tier: 'gold',
      company_number: 'DE-6721094',
      vat_number: 'DE982103948',
      phone: '+49 69 9876543',
      niches: [home.id],
    },
    {
      id: 'a4444444-4444-4000-8000-000000000004',
      company_name: 'Orbit Wholesale Europe B.V.',
      contact_name: 'Wouter van Dijk',
      contact_email: 'trade@orbitwholesale.nl',
      role: 'seller',
      approval_status: 'approved',
      tier: 'silver',
      company_number: 'NL-84920194',
      vat_number: 'NL849201940B01',
      phone: '+31 10 592 1029',
      niches: [beauty.id, electronics.id],
    },
    {
      id: 'a5555555-5555-4000-8000-000000000005',
      company_name: 'Nordic Electro Wholesale Ltd',
      contact_name: 'Lars Lindqvist',
      contact_email: 'seller@nordictech.eu',
      role: 'seller',
      approval_status: 'approved',
      tier: 'gold',
      company_number: '556123-4567',
      vat_number: 'SE556123456701',
      phone: '+46 8 123 4567',
      niches: [electronics.id],
    },
    {
      id: 'a6666666-6666-4000-8000-000000000006',
      company_name: 'Casa Vesta Ceramiche S.r.l.',
      contact_name: 'Matteo Rossi',
      contact_email: 'export@casavesta.it',
      role: 'seller',
      approval_status: 'approved',
      tier: 'gold',
      company_number: 'IT-0928103948',
      vat_number: 'IT09281039482',
      phone: '+39 051 682 9100',
      niches: [home.id],
    },
    {
      id: 'a7777777-7777-4000-8000-000000000007',
      company_name: 'Apex Wholesale UK Ltd',
      contact_name: 'Arthur Pendelton',
      contact_email: 'distribution@apexwholesale.co.uk',
      role: 'seller',
      approval_status: 'approved',
      tier: 'gold',
      company_number: '12849201',
      vat_number: 'GB982103948',
      phone: '+44 121 496 0123',
      niches: [electronics.id],
    },
    {
      id: 'a8888888-8888-4000-8000-000000000008',
      company_name: 'Bavaria Tech Logistics GmbH',
      contact_name: 'Maximilian Gruber',
      contact_email: 'lots@bavariatech.de',
      role: 'seller',
      approval_status: 'approved',
      tier: 'gold',
      company_number: 'HRB-194029',
      vat_number: 'DE940291048',
      phone: '+49 89 2019 4820',
      niches: [electronics.id, beauty.id],
    },
  ];

  console.log(`Upserting ${verifiedSellers.length} verified European sellers...`);
  for (const seller of verifiedSellers) {
    const { error: upsertErr } = await supabase.from('companies').upsert({
      id: seller.id,
      company_name: seller.company_name,
      contact_name: seller.contact_name,
      contact_email: seller.contact_email,
      role: seller.role,
      approval_status: seller.approval_status,
      tier: seller.tier,
      company_number: seller.company_number,
      vat_number: seller.vat_number,
      phone: seller.phone,
      niches: seller.niches,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (upsertErr) {
      console.error(`Error upserting seller ${seller.company_name}:`, upsertErr.message);
    } else {
      console.log(`  ✓ Seller ${seller.company_name}`);
    }
  }

  // 3. Define the 8 top quality live products
  const liveProducts = [
    {
      id: 'b1111111-1111-4000-8000-000000000001',
      company_id: 'a1111111-1111-4000-8000-000000000001', // Northgate Trading
      category_id: electronics.id,
      title: 'Wireless Noise-Cancelling Headphones (Sony WH-1000XM5)',
      description: 'Sealed retail boxes, original manufacturer batch. Official European warranty with EU plugs included. Palletized and ready for immediate collection or dispatch.',
      barcode_or_sku: '5013493820194',
      quantity_available: 320,
      moq: 20,
      unit_price: 189.5,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
      is_hot: true,
      status: 'active',
    },
    {
      id: 'b2222222-2222-4000-8000-000000000002',
      company_id: 'a2222222-2222-4000-8000-000000000002', // Lumiere Beauty Ltd
      category_id: beauty.id,
      title: 'Eau de Parfum 100ml, Sealed Batch (Chanel No. 5)',
      description: 'Factory-sealed master cartons, barcodes intact, batch codes on request. 100% authentic fragrance stock from authorized European supply channels.',
      barcode_or_sku: '3145891255300',
      quantity_available: 450,
      moq: 50,
      unit_price: 68.2,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80'],
      is_hot: true,
      status: 'active',
    },
    {
      id: 'b3333333-3333-4000-8000-000000000003',
      company_id: 'a3333333-3333-4000-8000-000000000003', // Hearth & Co
      category_id: home.id,
      title: 'Air Fryer 7.6L Dual Zone, Black',
      description: 'Full pallet available, 12 units per carton, UK and EU dual spec plugs. Master distributor clearance with full manufacturer warranty.',
      barcode_or_sku: '4006501239845',
      quantity_available: 180,
      moq: 12,
      unit_price: 94.5,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800&q=80'],
      is_hot: true,
      status: 'active',
    },
    {
      id: 'b4444444-4444-4000-8000-000000000004',
      company_id: 'a4444444-4444-4000-8000-000000000004', // Orbit Wholesale
      category_id: beauty.id,
      title: 'Electric Toothbrush Travel Case Set',
      description: 'Mixed colours, 20 units per box, ready to ship immediately from Rotterdam bonded hub. CE certified with inductive charging base.',
      barcode_or_sku: '8710103859201',
      quantity_available: 1200,
      moq: 144,
      unit_price: 8.95,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&q=80'],
      is_hot: true,
      status: 'active',
    },
    {
      id: 'b5555555-5555-4000-8000-000000000005',
      company_id: 'a7777777-7777-4000-8000-000000000007', // Apex Wholesale UK
      category_id: electronics.id,
      title: 'Apple iPhone 15 Pro Max 256GB Natural Titanium (EU Model)',
      description: 'Factory unlocked pristine retail inventory. Clean IMEIs, verified Apple authorized distributor origin. Physical stock located in bonded warehouse. Reverse-charge VAT compliant.',
      barcode_or_sku: '0195949038201',
      quantity_available: 85,
      moq: 10,
      unit_price: 890.0,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80'],
      is_hot: true,
      status: 'active',
    },
    {
      id: 'b6666666-6666-4000-8000-000000000006',
      company_id: 'a5555555-5555-4000-8000-000000000005', // Nordic Electro Wholesale
      category_id: electronics.id,
      title: 'Smart LED 4K UHD Monitors 27-inch',
      description: 'Grade-A surplus pallet, factory warranty, dual HDMI and USB-C connectivity. Master cartons of 2 units, shrink-wrapped on Euro pallets in Malmö hub.',
      barcode_or_sku: '7350024820194',
      quantity_available: 140,
      moq: 15,
      unit_price: 135.0,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80'],
      is_hot: false,
      status: 'active',
    },
    {
      id: 'b7777777-7777-4000-8000-000000000007',
      company_id: 'a8888888-8888-4000-8000-000000000008', // Bavaria Tech
      category_id: beauty.id,
      title: 'Dyson Supersonic Origin Hair Dryer (EU 2-Pin Commercial Lot)',
      description: 'Official wholesale batch with European 2-pin power plugs. Complete serial number traceability and manufacturer seals intact. Palletized and shrink-wrapped.',
      barcode_or_sku: '5025155074218',
      quantity_available: 150,
      moq: 15,
      unit_price: 225.0,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80'],
      is_hot: true,
      status: 'active',
    },
    {
      id: 'b8888888-8888-4000-8000-000000000008',
      company_id: 'a6666666-6666-4000-8000-000000000006', // Casa Vesta
      category_id: home.id,
      title: 'Ceramic Espresso Cup Set 6pc (Matte Artisan Glaze)',
      description: 'Matte glaze, food-grade certified, master cartons of 8 sets. Direct from artisan porcelain workshop in Emilia-Romagna. Safe pallet transport certified.',
      barcode_or_sku: '8001239847120',
      quantity_available: 480,
      moq: 48,
      unit_price: 14.8,
      currency: 'GBP',
      image_urls: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'],
      is_hot: false,
      status: 'active',
    },
  ];

  console.log(`\nUpserting ${liveProducts.length} live products...`);
  for (const prod of liveProducts) {
    const { error: prodErr } = await supabase.from('products').upsert({
      id: prod.id,
      company_id: prod.company_id,
      category_id: prod.category_id,
      title: prod.title,
      description: prod.description,
      barcode_or_sku: prod.barcode_or_sku,
      quantity_available: prod.quantity_available,
      moq: prod.moq,
      unit_price: prod.unit_price,
      currency: prod.currency,
      image_urls: prod.image_urls,
      is_hot: prod.is_hot,
      status: prod.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (prodErr) {
      console.error(`Error upserting product ${prod.title}:`, prodErr.message);
    } else {
      console.log(`  ✓ Product ${prod.title}`);
    }
  }

  console.log('\n=== SEEDING COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);

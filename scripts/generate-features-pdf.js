const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function createFeaturesPdf(outputPath) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 38, bottom: 40, left: 42, right: 42 },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const primaryColor = '#0B1F3A';   // Dark Navy
  const brandBlue = '#0A6CFF';      // B2B Link Blue
  const cyanAccent = '#00C2FF';     // Cyan accent
  const greenBadge = '#15803D';     // Forest green
  const greenBg = '#DCFCE7';        // Soft green
  const amberColor = '#B45309';     // Amber
  const textDark = '#1E293B';       // Slate 800
  const textMuted = '#64748B';      // Slate 500
  const borderColor = '#CBD5E1';    // Slate 300
  const cardBg = '#F8FAFC';         // Very light slate

  function drawCard(x, y, w, h, bgColor = '#FFFFFF', strokeColor = borderColor) {
    doc.save();
    doc.roundedRect(x, y, w, h, 6).fillAndStroke(bgColor, strokeColor);
    doc.restore();
  }

  // --- PAGE 1: HEADER & EXECUTIVE OVERVIEW ---
  // Top Banner
  doc.save();
  doc.roundedRect(42, 38, 511, 56, 8).fill('#0B1F3A');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('B2B ', 58, 48, { continued: true });
  doc.fillColor(cyanAccent).text('LINK', { continued: true });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(11).text('  |  Commercial Feature Catalog & Packaging Guide');
  doc.fillColor('#E2E8F0').font('Helvetica-Bold').fontSize(10).text('EXECUTIVE CLIENT BRIEFING  |  0% COMMISSION WHOLESALE EXCHANGE', 58, 73);
  doc.restore();

  doc.y = 108;

  // Title
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(17).text('PLATFORM FEATURES & COMMERCIAL PACKAGING GUIDE');
  doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(9.5).text('Complete capability inventory for customer accounts, tier packaging & pricing strategy', { lineGap: 3 });
  doc.moveDown(0.5);

  // Executive Overview Card
  const execY = doc.y;
  drawCard(42, execY, 511, 74, '#F0F7FF', '#BFDBFE');
  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(10).text('EXECUTIVE SUMMARY & BUSINESS MODEL', 54, execY + 8);
  doc.fillColor(textDark).font('Helvetica').fontSize(8.5).text(
    'B2B LINK operates as a zero-commission (0% platform transaction fee) European wholesale trading exchange.\n' +
    'Unlike retail marketplaces that levy 3% to 8% per transaction, all wholesale lots are settled directly between buyer\n' +
    'and seller corporate accounts via Wise Business or SEPA wire under proforma invoices.\n\n' +
    'Monetization is driven exclusively by Monthly Membership Subscriptions and Lead Unlock Credits.',
    54,
    execY + 22,
    { width: 485, lineGap: 2 }
  );

  doc.y = execY + 84;

  // Section 1: Core Features for Any Registered Member
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('1. CORE CAPABILITIES (ANY REGISTERED USER)');
  doc.fillColor(textMuted).font('Helvetica').fontSize(8.5).text('Available to both Commercial Buyers and Verified European Suppliers upon account creation:');
  doc.moveDown(0.3);

  const coreBoxY = doc.y;
  drawCard(42, coreBoxY, 511, 102, '#FFFFFF', borderColor);

  // Feature 1
  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(9).text('A. Live Trading Board & Marketplace Search', 52, coreBoxY + 8);
  doc.fillColor(textDark).font('Helvetica').fontSize(8).text(
    'Real-time access to active Want-To-Buy requests and wholesale inventory stock lots across Europe. Universal multi-parameter filter search by Brand, Model / Item Code, EAN/UPC barcode, and niche category with zero horizontal scroll clutter.',
    52, coreBoxY + 19, { width: 490, lineGap: 1.5 }
  );

  // Feature 2
  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(9).text('B. Privacy-Protected Lead Unlocking System', 52, coreBoxY + 44);
  doc.fillColor(textDark).font('Helvetica').fontSize(8).text(
    'Public viewers and basic accounts see product specs, quantities, target prices, and warehouse locations. Direct corporate names, emails, and direct phone lines are locked. Members use monthly Unlock Credits to reveal verified credentials permanently.',
    52, coreBoxY + 55, { width: 490, lineGap: 1.5 }
  );

  // Feature 3
  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(9).text('C. Direct Multi-Channel Outreach', 52, coreBoxY + 80);
  doc.fillColor(textDark).font('Helvetica').fontSize(8).text(
    'Unlocked counterparties can be contacted immediately via "Email Directly" (pre-populated order terms), in-app Live Chat negotiation desk, or formal inquiry / quotation submission.',
    52, coreBoxY + 91, { width: 490, lineGap: 1.5 }
  );

  doc.y = coreBoxY + 112;

  // Section 2: Buyer Sourcing Features
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('2. COMMERCIAL BUYER FEATURES (SOURCING DESK)');
  doc.fillColor(textMuted).font('Helvetica').fontSize(8.5).text('Empowering retail purchasing managers, wholesalers, and e-commerce stock buyers:');
  doc.moveDown(0.3);

  const buyerY = doc.y;
  drawCard(42, buyerY, 511, 110, cardBg, borderColor);

  const buyerFeatures = [
    { title: 'Post Sourcing Requests (WTB)', desc: 'Publish Want-To-Buy requests with target unit prices, required volumes, EAN barcodes, and delivery destination hubs (DE, NL, FR, UK, etc.).' },
    { title: 'Fast Image-Free Posting', desc: 'No photo uploads required. Commercial buyers only need to input model codes and barcodes, cutting posting time down to under 60 seconds.' },
    { title: 'Automated Seller Broadcast', desc: 'The platform instantly alerts all verified European suppliers holding relevant product categories or specific barcodes via email.' },
    { title: 'Incoming Quotation Management', desc: 'Centralized hub (/dashboard/requests) to review seller quotes side-by-side: offered unit price, quantity available, lead time, and seller compliance notes.' },
  ];

  let bOffset = buyerY + 8;
  buyerFeatures.forEach((f, idx) => {
    doc.fillColor(greenBadge).font('Helvetica-Bold').fontSize(8.5).text(`[+] ${f.title}: `, 52, bOffset, { continued: true });
    doc.fillColor(textDark).font('Helvetica').text(f.desc, { width: 485, lineGap: 1.5 });
    bOffset += 24;
  });

  doc.y = buyerY + 120;

  // Section 3: Seller Distribution Features
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('3. VERIFIED SELLER FEATURES (WHOLESALE DESK)');
  doc.fillColor(textMuted).font('Helvetica').fontSize(8.5).text('Tools for European stockists, authorized distributors, and volume liquidators:');
  doc.moveDown(0.3);

  const sellerY = doc.y;
  drawCard(42, sellerY, 511, 140, cardBg, borderColor);

  const sellerFeatures = [
    { title: '24-Hour Compliance Vetting', desc: 'Sellers receive a verified trust badge upon desk review of their EU VAT registration and commercial documentation, building instant buyer credibility.' },
    { title: '2-Step Image-Free Stock Listing', desc: 'Post parcels and pallet lots without photography overhead: Step 1 (Brand, Item Code, EAN, Category, Condition), Step 2 (Price, Available Units, MOQ, Location).' },
    { title: 'Bulk CSV Inventory Upload', desc: 'Upload large spreadsheets containing hundreds of SKUs simultaneously via the CsvImportModal, instantly populating the Live Trading Board.' },
    { title: 'Hot Lot Promotion Highlighting', desc: 'Apply a "Hot" badge to time-sensitive stock clearance or high-demand parcels to position them prominently on the exchange.' },
    { title: 'Proactive Bidding on Buyer Requests', desc: 'Browse live buyer requests and dispatch competitive price quotes directly to commercial buyers looking to buy today.' },
    { title: 'Sent Quotes Tracker', desc: 'Real-time sales dashboard (/dashboard/quotes) monitoring quote delivery status (Sent, Unlocked, Accepted, Negotiating).' },
  ];

  let sOffset = sellerY + 8;
  sellerFeatures.forEach((f) => {
    doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(8.5).text(`[*] ${f.title}: `, 52, sOffset, { continued: true });
    doc.fillColor(textDark).font('Helvetica').text(f.desc, { width: 485, lineGap: 1.5 });
    sOffset += 22;
  });

  // --- PAGE 2: PACKAGING MATRIX & STRATEGY ---
  doc.addPage();

  // Top header mini banner on page 2
  doc.save();
  doc.roundedRect(42, 38, 511, 38, 6).fill('#0B1F3A');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text('B2B ', 54, 48, { continued: true });
  doc.fillColor(cyanAccent).text('LINK', { continued: true });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(9.5).text('  |  Membership Tiers & Feature Packaging Matrix');
  doc.restore();

  doc.y = 88;

  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13).text('4. RECOMMENDED MEMBERSHIP TIERS & PACKAGING MATRIX');
  doc.fillColor(textMuted).font('Helvetica').fontSize(8.5).text('A battle-tested 3-tier structure designed to maximize free buyer adoption while monetizing active sellers:');
  doc.moveDown(0.4);

  // Table Matrix
  const tableY = doc.y;
  const colWidths = [185, 100, 110, 116];
  const colX = [42, 227, 327, 437];
  const rowHeight = 20;

  // Table Header
  drawCard(42, tableY, 511, 24, '#EEF2F6', '#CBD5E1');
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5);
  doc.text('FEATURE / LEVER', colX[0] + 8, tableY + 7);
  doc.text('BRONZE (FREE)', colX[1] + 6, tableY + 7);
  doc.text('SILVER (PRO TRADER)', colX[2] + 6, tableY + 7);
  doc.text('GOLD (ENTERPRISE)', colX[3] + 6, tableY + 7);

  const tableRows = [
    { name: 'Target Audience', bronze: 'New Buyers / Sourcing Desks', silver: 'Active Wholesale Traders', gold: 'High-Volume Distributors' },
    { name: 'Suggested Price', bronze: '€0 / Free Forever', silver: '€99 – €149 / month', gold: '€249 – €399 / month' },
    { name: 'Live Trading Board Browsing', bronze: 'Full Unlimited Access', silver: 'Full Unlimited Access', gold: 'Full Unlimited Access' },
    { name: 'Monthly Contact Unlocks', bronze: '2 Unlocks / month', silver: '15 Unlocks / month', gold: 'UNLIMITED Unlocks' },
    { name: 'Active Stock Listings', bronze: 'Up to 2 listings', silver: 'Up to 25 listings', gold: 'UNLIMITED listings' },
    { name: 'Post Want-To-Buy (WTB)', bronze: 'UNLIMITED (Free)', silver: 'UNLIMITED', gold: 'UNLIMITED' },
    { name: 'Quotes to Buyer Requests', bronze: '3 quotes / month', silver: '25 quotes / month', gold: 'UNLIMITED quotes' },
    { name: 'Bulk CSV Manifest Upload', bronze: 'Not Included', silver: 'Included (up to 500 SKUs)', gold: 'Included (Unlimited SKUs)' },
    { name: 'Hot Lot Feature Badges', bronze: 'Not Included', silver: '3 active Hot Lots', gold: 'UNLIMITED Hot Lots' },
    { name: 'Direct Email Action (mailto:)', bronze: 'Locked', silver: 'Included', gold: 'Included + Dedicated Desk' },
    { name: 'Live In-App Chat', bronze: 'Included', silver: 'Included', gold: 'Included + Instant Push' },
    { name: 'Matching Buyer Deal Alerts', bronze: 'Weekly Digest', silver: 'Instant Email Alerts', gold: 'Instant + SMS/WhatsApp' },
    { name: 'Seller Trust Badging', bronze: 'Basic Registered Member', silver: 'Verified Supplier', gold: 'Gold Vetted Enterprise' },
    { name: 'Platform Commission Fee', bronze: '0% Commission', silver: '0% Commission', gold: '0% Commission' },
  ];

  let currentY = tableY + 24;
  tableRows.forEach((r, idx) => {
    const isAlt = idx % 2 === 1;
    const bg = isAlt ? '#F8FAFC' : '#FFFFFF';
    drawCard(42, currentY, 511, rowHeight, bg, '#E2E8F0');

    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8).text(r.name, colX[0] + 8, currentY + 5);
    
    // Bronze
    doc.fillColor(textDark).font('Helvetica').fontSize(7.5).text(r.bronze, colX[1] + 6, currentY + 5);
    
    // Silver
    doc.fillColor(r.silver.includes('UNLIMITED') ? brandBlue : textDark)
       .font(r.silver.includes('UNLIMITED') ? 'Helvetica-Bold' : 'Helvetica')
       .text(r.silver, colX[2] + 6, currentY + 5);
    
    // Gold
    doc.fillColor(r.gold.includes('UNLIMITED') || r.gold.includes('Gold') ? greenBadge : textDark)
       .font('Helvetica-Bold')
       .text(r.gold, colX[3] + 6, currentY + 5);

    currentY += rowHeight;
  });

  doc.y = currentY + 16;

  // Section 5: Strategic Advice for the Client
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('5. STRATEGIC RECOMMENDATIONS FOR YOUR CLIENT');
  doc.moveDown(0.3);

  const stratY = doc.y;
  drawCard(42, stratY, 511, 108, '#F1F5FB', '#BFDBFE');

  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(9).text('1. KEEP BUYERS 100% FREE', 54, stratY + 8);
  doc.fillColor(textDark).font('Helvetica').fontSize(8).text(
    'Never charge retail buyers or procurement departments to submit Want-To-Buy requests. High buyer liquidity and\n' +
    'open sourcing volume creates the marketplace gravity that compels verified sellers to happily pay monthly subscription fees.',
    54, stratY + 20, { width: 485, lineGap: 1.5 }
  );

  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(9).text('2. MONETIZE "UNLOCK CREDITS" AND "LISTING CAPACITY"', 54, stratY + 44);
  doc.fillColor(textDark).font('Helvetica').fontSize(8).text(
    'Traders with large inventories readily subscribe to €149 or €299 tiers because 15 to 25 extra listings and unlimited buyer\n' +
    'contacts pay for themselves on their very first closed wholesale order.',
    54, stratY + 56, { width: 485, lineGap: 1.5 }
  );

  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(9).text('3. CHAMPION THE "0% TRANSACTION COMMISSION" ADVANTAGE', 54, stratY + 78);
  doc.fillColor(textDark).font('Helvetica').fontSize(8).text(
    'Marketplaces like Amazon Business or traditional broker platforms charge 3% to 8% per transaction. On a €50,000 electronics\n' +
    'order, that is a €2,500 fee. B2B LINK charges €0 on trades, making a €249/mo membership an irresistible proposition.',
    54, stratY + 90, { width: 485, lineGap: 1.5 }
  );

  // Footer on all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.rect(42, 800, 511, 0.5).fill('#CBD5E1');
    doc.fillColor(textMuted).font('Helvetica').fontSize(7.5).text(
      'B2B LINK OÜ  |  Commercial Specifications & Tier Packaging Guide  |  Strictly Confidential',
      42,
      806,
      { width: 380 }
    );
    doc.text(`Page ${i + 1} of ${totalPages}`, 480, 806, { align: 'right', width: 73 });
    doc.restore();
  }

  doc.end();
}

const targetPath = path.join(__dirname, '..', 'B2B_LINK_Features_and_Packaging_Guide.pdf');
createFeaturesPdf(targetPath);
console.log('PDF successfully generated at:', targetPath);

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function createAutomatedMessagesPdf(outputPath) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const primaryColor = '#0B1F3A';   // Dark Navy
  const brandBlue = '#0A6CFF';      // B2B Link Blue
  const cyanAccent = '#00C2FF';     // Cyan accent
  const greenBadge = '#16A34A';     // Success green
  const amberBadge = '#D97706';     // Warning amber
  const textDark = '#1E293B';       // Slate 800
  const textMuted = '#64748B';      // Slate 500
  const borderColor = '#E2E8F0';    // Border gray

  function drawCard(x, y, w, h, bgColor = '#FFFFFF', strokeColor = borderColor) {
    doc.save();
    doc.roundedRect(x, y, w, h, 8)
       .fillAndStroke(bgColor, strokeColor);
    doc.restore();
  }

  // Header banner on first page
  doc.save();
  doc.roundedRect(45, 40, 505, 54, 8).fill('#0B1F3A');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('B2B ', 60, 52, { continued: true });
  doc.fillColor(cyanAccent).text('LINK', { continued: true });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(11).text('  |  Automated Communications & Verification Guide');
  doc.fillColor('#E2E8F0').font('Helvetica-Bold').fontSize(10.5).text('B2B LINK OÜ  |  INTERNAL PLATFORM SPECIFICATION', 60, 72);
  doc.restore();

  doc.y = 108;

  // Title & Metadata
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(18).text('AUTOMATED COMMUNICATIONS & VERIFICATION GUIDE');
  doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(10).text('Final reviewed wording for platform implementation', { lineGap: 4 });
  doc.moveDown(0.6);

  // Executive Summary Box
  const summaryY = doc.y;
  drawCard(45, summaryY, 505, 84, '#F1F5FB', '#BFDBFE');
  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(10.5).text('SYSTEM OVERVIEW & LIFECYCLE TRIGGERS', 60, summaryY + 10);
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text(
    'All B2B LINK accounts are unified wholesale accounts that can be used to both buy and sell products.\n\nNewly registered accounts remain in Pending Verification status until the required business checks have been completed. Verification confirms that B2B LINK has carried out its membership checks; it does not guarantee a company, product or transaction.\n\nThis guide defines the approved automated email, in-app and internal admin messages used throughout registration, verification, onboarding and support. Automated customer-facing messages should come from a B2B LINK department rather than an individual staff member.',
    60,
    summaryY + 24,
    { width: 475, lineGap: 2 }
  );

  doc.y = summaryY + 96;

  // Approved Department Names Box
  const deptY = doc.y;
  drawCard(45, deptY, 505, 66, '#FFFFFF', borderColor);
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9.5).text('APPROVED DEPARTMENT NAMES', 55, deptY + 8);
  doc.fillColor(textDark).font('Helvetica').fontSize(8.5).text(
    '• B2B LINK Support Team - General enquiries, welcome messages and account help.\n• B2B LINK Verification Team - Business verification, additional information requests and account reviews.\n• B2B LINK Membership Team - Membership plans, renewals and account-plan matters.\n• B2B LINK Trading Support - Trading Board and listing assistance.',
    55,
    deptY + 22,
    { width: 480, lineGap: 2.5 }
  );

  doc.y = deptY + 76;

  function renderMessageItem(number, title, channel, trigger, recipient, subject, bodyContent) {
    const cardHeight = 150;
    if (doc.y + cardHeight > 740) {
      doc.addPage();
      doc.y = 50;
    }

    const currentY = doc.y;
    drawCard(45, currentY, 505, cardHeight, '#FFFFFF', borderColor);

    // Title bar
    doc.save();
    doc.roundedRect(45, currentY, 505, 24, 8).fill('#F8FAFC');
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text(`${number}. ${title}`, 55, currentY + 7);

    const badgeColor = channel === 'EMAIL' ? brandBlue : channel === 'IN-APP CHAT' ? greenBadge : amberBadge;
    doc.fillColor(badgeColor).font('Helvetica-Bold').fontSize(8).text(channel, 480, currentY + 7, { width: 60, align: 'right' });
    doc.restore();

    // Meta details
    const metaY = currentY + 30;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(textMuted).text('Trigger Event:', 55, metaY);
    doc.font('Helvetica').fontSize(8).fillColor(textDark).text(trigger, 135, metaY, { width: 400 });

    doc.font('Helvetica-Bold').fontSize(8).fillColor(textMuted).text('Recipient:', 55, metaY + 12);
    doc.font('Helvetica').fontSize(8).fillColor(textDark).text(recipient, 135, metaY + 12, { width: 400 });

    if (subject) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(textMuted).text('Subject Line:', 55, metaY + 24);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(brandBlue).text(subject, 135, metaY + 24, { width: 400 });
    }

    // Message Body Box
    const bodyBoxY = currentY + 68;
    drawCard(55, bodyBoxY, 485, 72, '#F8FAFC', '#E2E8F0');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted).text('APPROVED MESSAGE CONTENT / PREVIEW:', 65, bodyBoxY + 5);
    doc.font('Helvetica').fontSize(8).fillColor(textDark).text(bodyContent, 65, bodyBoxY + 16, { width: 465, lineGap: 1.8 });

    doc.y = currentY + cardHeight + 12;
  }

  // SECTION 1: EMAIL NOTIFICATIONS
  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(13).text('SECTION 1: AUTOMATED EMAIL MESSAGES');
  doc.strokeColor(brandBlue).lineWidth(1.5).moveTo(45, doc.y + 2).lineTo(550, doc.y + 2).stroke();
  doc.moveDown(0.7);

  // 1. Email Verification
  renderMessageItem(
    '1',
    'Email Verification',
    'EMAIL',
    'User submits the registration form',
    'Registered business email address',
    'Verify Your Email Address - B2B LINK',
    'Hello [Contact Name],\nWelcome to B2B LINK.\nTo verify your email address and continue setting up your account, please enter the following verification code:\n[Verification Code] (This code is valid for 15 minutes.)\nAlternatively, click the button below to verify your email address: [Verify Email Address]\nKind regards,\nB2B LINK Support Team'
  );

  // 2. Business Verification Request
  renderMessageItem(
    '2',
    'Business Verification Request',
    'EMAIL',
    'Sent after the business email address has been verified',
    'Registered customer contact email',
    'Action Required: Complete Your B2B LINK Business Verification',
    'Hello [Contact Name],\nThank you for registering [Company Name] with B2B LINK.\nYour email address has been verified, and your account is now awaiting business verification.\nOur Verification Team may check information including company registration details, VAT details where applicable, business contact information, company email/domain and bank account information. If we require any additional information or supporting documents, we will contact you directly.\nYour account will remain in Pending Verification status until the review has been completed.\nKind regards,\nB2B LINK Verification Team'
  );

  // 3. New Member Verification - Internal Admin Alert
  renderMessageItem(
    '3',
    'New Member Verification - Internal Admin Alert',
    'EMAIL',
    'Generated automatically when a new company registers',
    'Internal B2B LINK administration / verification queue',
    'New Member Verification Required - [Company Name]',
    'A new company has registered with B2B LINK and is awaiting verification.\nCompany: [Company Name] | Contact: [Contact Name] | Email: [Email] | Telephone: [Phone] | Country: [Country]\nPlease review the company information in the Admin Panel and complete the required verification checks.\nCurrent Status: Pending Verification'
  );

  // 4. Account Verified
  renderMessageItem(
    '4',
    'Account Verified',
    'EMAIL',
    'Sent when the Verification Team activates the member account',
    'Customer business email address',
    'Your B2B LINK Account Has Been Verified',
    'Hello [Contact Name],\nWe are pleased to confirm that the business verification for [Company Name] has been completed.\nYour account is now active and your company has Verified Member status on B2B LINK.\nYou can now access the features available under your membership, including:\n• Browse live BUY and SELL listings  • Post and manage your own BUY and SELL requirements\n• Receive relevant Buyer-Seller Matches  • Search for products and trading opportunities  • Connect directly with other members\nYou can log in to your account to get started. Welcome to B2B LINK.\nKind regards,\nB2B LINK Verification Team'
  );

  // 5. Account Under Review / Suspended
  renderMessageItem(
    '5',
    'Account Under Review / Suspended',
    'EMAIL',
    'Sent when additional verification information is required, or when an active account is placed under review',
    'Customer business email address',
    'Update Regarding Your B2B LINK Account',
    'Hello [Contact Name],\nWe are contacting you regarding the B2B LINK account for [Company Name].\nAccount Status: Under Review\nWe require additional information before we can complete the verification of your account. Please reply to this email with any information requested by our Verification Team. Once the required information has been received, we will continue our review and update you as soon as possible.\nKind regards,\nB2B LINK Verification Team\n(Suspended note: "Account Status: Suspended. Your B2B LINK account has been temporarily suspended while we review an account or verification matter. Please contact the B2B LINK Verification Team for further information.")'
  );

  // SECTION 2: IN-APP & DASHBOARD MESSAGES
  if (doc.y > 550) {
    doc.addPage();
    doc.y = 50;
  } else {
    doc.moveDown(0.8);
  }

  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(13).text('SECTION 2: IN-APP & DASHBOARD MESSAGES');
  doc.strokeColor(brandBlue).lineWidth(1.5).moveTo(45, doc.y + 2).lineTo(550, doc.y + 2).stroke();
  doc.moveDown(0.7);

  // 6. In-App Welcome Message
  renderMessageItem(
    '6',
    'In-App Welcome Message',
    'IN-APP CHAT',
    'Displayed automatically after account creation / first access to messages',
    'Customer in-app messaging panel',
    null,
    'Sender: B2B LINK Support Team\n\nHello [First Name],\nWelcome to B2B LINK.\nB2B LINK is designed to make wholesale trading faster and simpler.\nYou can use the platform to:\n• Browse live BUY and SELL listings  • Post what you have available or what you need\n• Receive relevant Buyer-Seller Matches  • Search by product, EAN/UPC or item code  • Connect directly with other members\nIf you need any assistance, our Support Team is here to help. Welcome to the network.\nKind regards,\nB2B LINK Support Team'
  );

  // 7. First-Login Welcome
  renderMessageItem(
    '7',
    'First-Login Welcome',
    'MODAL / POPUP',
    'Displayed on the member’s first dashboard login',
    'User browser / dashboard (WelcomeModal)',
    null,
    'Title: Welcome to B2B LINK\n\nLive Trading Board: Browse current BUY and SELL listings from B2B LINK members.\nBuyer-Seller Match: Receive relevant matches based on the products you are buying or selling.\nFast Product Posting: Use EAN/UPC and product information to create listings quickly.\nDirect Contact: Connect directly with relevant trading partners.\n0% Transaction Commission: B2B LINK does not charge commission on trades between members.\nAction: [Go to Trading Board]'
  );

  // 8. Customer Support Reply
  renderMessageItem(
    '8',
    'Customer Support Reply',
    'EMAIL',
    'Sent when B2B LINK replies to a customer enquiry',
    'Prospective or registered customer email address',
    'Response from B2B LINK Support',
    'Hello [Customer Name],\nThank you for contacting B2B LINK.\nOur Support Team has reviewed your enquiry regarding [Company Name].\nOur response: [Support Reply Message]\nYour original enquiry: [Customer Query]\nYou can reply directly to this email if you require any further assistance.\nKind regards,\nB2B LINK Support Team'
  );

  // FINAL TERMINOLOGY STANDARD TABLE
  if (doc.y > 580) {
    doc.addPage();
    doc.y = 50;
  } else {
    doc.moveDown(0.8);
  }

  doc.fillColor(brandBlue).font('Helvetica-Bold').fontSize(13).text('FINAL TERMINOLOGY STANDARD');
  doc.strokeColor(brandBlue).lineWidth(1.5).moveTo(45, doc.y + 2).lineTo(550, doc.y + 2).stroke();
  doc.moveDown(0.7);

  const termTableY = doc.y;
  drawCard(45, termTableY, 505, 130, '#FFFFFF', borderColor);
  doc.roundedRect(45, termTableY, 505, 22, 8).fill(primaryColor);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text('USE (APPROVED)', 55, termTableY + 6);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text('AVOID / REPLACE', 270, termTableY + 6);

  const termRows = [
    ['Verified Member', 'Certified business / approved trader'],
    ['Business Verification', 'KYC, unless legally required for a specific process'],
    ['BUY / SELL listing', 'WTB / procurement request, unless intentionally used'],
    ['B2B LINK Support Team', 'Compliance Desk for ordinary customer support'],
    ['Under Review', 'Suspended, unless the account has actually been suspended'],
    ['Buyer-Seller Match', 'AI Match / Smart Match in customer-facing core terminology'],
  ];

  termRows.forEach((row, idx) => {
    const rowY = termTableY + 28 + (idx * 16);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text(row[0], 55, rowY);
    doc.fillColor(textMuted).font('Helvetica').fontSize(8.5).text(row[1], 270, rowY);
  });

  doc.y = termTableY + 140;
  doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(8).text(
    'Implementation note: Customer-facing automated communications should be sent from the appropriate B2B LINK department rather than a named individual, so messaging remains consistent if staff responsibilities change.',
    45,
    doc.y,
    { width: 505 }
  );

  // Page Numbers Footer on all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.strokeColor(borderColor).lineWidth(1).moveTo(45, 800).lineTo(550, 800).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(textMuted)
       .text('B2B LINK OÜ  •  Narva mnt 5, 10117 Tallinn, Estonia  •  Registered in Estonia (EU)', 45, 806);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(brandBlue)
       .text(`Page ${i + 1} of ${totalPages}`, 500, 806, { align: 'right' });
    doc.restore();
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

const outputPath = path.resolve(__dirname, '../Automated_Messages_Guide.pdf');
createAutomatedMessagesPdf(outputPath)
  .then((file) => {
    console.log(`[SUCCESS] PDF generated successfully at: ${file}`);
    const stats = fs.statSync(file);
    console.log(`[FILE SIZE] ${(stats.size / 1024).toFixed(1)} KB`);
  })
  .catch((err) => {
    console.error('[ERROR] Failed to generate PDF:', err);
    process.exit(1);
  });

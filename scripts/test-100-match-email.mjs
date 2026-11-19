import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';

// Generate 100 realistic consumer technology wholesale stock items
const brands = [
  {
    brand: 'Apple',
    models: [
      'iPhone 16 Pro Max 256GB Titanium',
      'iPhone 16 Pro 128GB Black Titanium',
      'iPhone 15 Pro Max 512GB Natural Titanium',
      'iPhone 15 128GB Blue',
      'iPhone 14 128GB Midnight',
      'iPad Pro 13" M4 256GB Space Black',
      'iPad Air 11" M2 128GB Starlight',
      'iPad 10th Gen 64GB Silver',
      'MacBook Air 15" M3 16GB/512GB Midnight',
      'MacBook Pro 16" M3 Max 36GB/1TB Space Black',
      'AirPods Pro (2nd Gen) USB-C MagSafe',
      'AirPods Max USB-C Space Gray',
      'Apple Watch Ultra 2 49mm Titanium',
      'Apple Watch Series 10 46mm Jet Black',
    ],
  },
  {
    brand: 'Samsung',
    models: [
      'Galaxy S24 Ultra 512GB Titanium Gray',
      'Galaxy S24+ 256GB Onyx Black',
      'Galaxy S24 128GB Marble Gray',
      'Galaxy Z Fold 6 512GB Silver Shadow',
      'Galaxy Z Flip 6 256GB Mint',
      'Galaxy Tab S9 Ultra 256GB Graphite',
      'Galaxy Tab S9 FE 128GB Gray',
      'Galaxy Watch 7 44mm Green',
      'Galaxy Buds 3 Pro Silver',
      'Galaxy A55 5G 128GB Awesome Navy',
      'Galaxy A35 5G 128GB Awesome Iceblue',
    ],
  },
  {
    brand: 'Sony',
    models: [
      'PlayStation 5 Slim Disc Edition 1TB',
      'PlayStation 5 Digital Edition 1TB',
      'PlayStation Portal Remote Player',
      'DualSense Wireless Controller White',
      'WH-1000XM5 Wireless Noise Canceling Black',
      'WH-1000XM4 Wireless Noise Canceling Silver',
      'WF-1000XM5 True Wireless Earbuds Black',
    ],
  },
  {
    brand: 'Google',
    models: [
      'Pixel 9 Pro XL 256GB Obsidian',
      'Pixel 9 Pro 128GB Porcelain',
      'Pixel 9 128GB Wintergreen',
      'Pixel 8a 128GB Bay',
      'Pixel Watch 3 45mm Matte Black',
      'Pixel Buds Pro 2 Hazel',
    ],
  },
  {
    brand: 'Nintendo',
    models: [
      'Switch OLED Model White',
      'Switch OLED Model Neon Blue/Red',
      'Switch Standard Neon',
      'Switch Lite Turquoise',
      'Pro Controller Wireless Black',
    ],
  },
  {
    brand: 'Dell & Lenovo',
    models: [
      'Dell XPS 15 9530 Core i7 32GB/1TB RTX 4060',
      'Dell XPS 13 Plus Core i7 16GB/512GB',
      'Lenovo ThinkPad X1 Carbon Gen 12 Core Ultra 7',
      'Lenovo Legion 5 Pro 16" Ryzen 7/16GB/1TB RTX 4070',
      'Dell Latitude 5540 Core i5 16GB/512GB',
    ],
  },
  {
    brand: 'Audio & Acoustics',
    models: [
      'Bose QuietComfort Ultra Headphones Black',
      'Bose QuietComfort Earbuds II Triple Black',
      'Bose SoundLink Max Bluetooth Speaker Black',
      'JBL Boombox 3 Wi-Fi Black',
      'JBL PartyBox Stage 320 Black',
      'Marshall Stanmore III Bluetooth Speaker Black',
    ],
  },
  {
    brand: 'Dyson & Tech',
    models: [
      'Dyson V15 Detect Absolute Cordless',
      'Dyson Airwrap Multi-Styler Complete Long Nickel/Copper',
      'Dyson Supersonic Nural Hair Dryer Strawberry Bronze',
    ],
  },
];

const conditions = [
  'New Sealed',
  'New Sealed',
  'New Sealed',
  'A Grade (Pristine)',
  '14-Day Return',
  'CPO Refurbished',
];

const sample100Items = [];
while (sample100Items.length < 100) {
  for (const group of brands) {
    if (sample100Items.length >= 100) break;
    const model = group.models[sample100Items.length % group.models.length];
    const cond = conditions[sample100Items.length % conditions.length];
    const qty = Math.floor(Math.random() * 450) + 25; // 25 to 500 units
    const eanBase = 8400000000000 + sample100Items.length * 137;

    sample100Items.push({
      name: `${group.brand} ${model}`,
      barcodeOrSku: String(eanBase),
      quantity: qty,
      condition: cond,
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailWrapper(title, badge, content, ctaUrl, ctaText) {
  const logoUrl =
    'https://qmosgopkjqrqogsdgwuy.supabase.co/storage/v1/object/public/public-assets/b2b-link-logo-tight.png';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap');
    body, table, td, p, a, h1, h2, h3, span {
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F6FB; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F3F6FB; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #EAEFF6; box-shadow: 0 10px 30px rgba(11, 31, 58, 0.06); overflow: hidden;">
          
          <!-- Header with Logo and Badge -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #F1F5F9;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <a href="https://b2blink.eu" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="${logoUrl}" alt="B2B LINK OÜ" width="140" style="display: block; max-width: 140px; height: auto; border: 0;" />
                    </a>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
                      ${badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              ${content}

              <!-- Pill CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #0A6CFF; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(10, 108, 255, 0.3);">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 36px; border-top: 1px solid #EAEFF6; font-size: 12px; color: #64748B; line-height: 1.6; text-align: center;">
              <p style="margin: 0 0 6px 0; font-weight: 700; color: #0B1F3A;">
                B2B LINK OÜ &bull; Narva mnt 5, 10117 Tallinn, Estonia
              </p>
              <p style="margin: 0 0 8px 0; color: #8A9BB0;">
                The verified global wholesale trading network &bull; 0% transaction commission
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                Need assistance? Contact our verification desk at <a href="mailto:support@b2blink.eu" style="color: #0A6CFF; text-decoration: none; font-weight: 600;">support@b2blink.eu</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildConsolidatedEmail(recipientName, items, actionUrl) {
  const count = items.length;
  const subject = `[MATCH ALERT] ${count} Matching Stock Items Available for Your Procurement Requests`;

  const rowsHtml = items
    .map((item, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cleanName = escapeHtml(item.name);
      const cleanBarcode = item.barcodeOrSku ? escapeHtml(item.barcodeOrSku) : '—';
      const qtyText = item.quantity ? `${item.quantity.toLocaleString()} units` : '1+';
      const conditionBadge =
        item.condition && item.condition.toLowerCase() !== 'new'
          ? `<span style="display: inline-block; font-size: 10px; font-weight: 700; background-color: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${escapeHtml(item.condition)}</span>`
          : '';

      return `
        <tr style="background-color: ${bg}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 6px; color: #64748b; font-weight: 700; font-size: 12px; text-align: center; vertical-align: top; width: 34px;">
            ${idx + 1}
          </td>
          <td style="padding: 8px 6px; color: #0b1f3a; font-weight: 700; font-size: 12.5px; line-height: 1.4; vertical-align: top;">
            ${cleanName}${conditionBadge}
          </td>
          <td style="padding: 8px 6px; color: #059669; font-weight: 700; font-size: 12.5px; text-align: right; white-space: nowrap; vertical-align: top; width: 85px;">
            ${qtyText}
          </td>
          <td style="padding: 8px 6px; color: #64748b; font-family: monospace; font-size: 11px; vertical-align: top; white-space: nowrap; width: 110px;">
            ${cleanBarcode}
          </td>
        </tr>
      `;
    })
    .join('');

  const content = `
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
      <span style="font-weight: 800; color: #047857; font-size: 14px;">
        ⚡ ${count} Stock Matches Identified
      </span>
      <p style="font-size: 13px; color: #065f46; margin: 4px 0 0 0;">
        Verified wholesale suppliers have listed inventory matching your active procurement requests on B2B LINK.
      </p>
    </div>

    <h2 style="font-size: 20px; font-weight: 800; color: #0b1f3a; margin: 0 0 12px 0;">Hello ${escapeHtml(recipientName)},</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Good news! We have identified <strong>${count} matching wholesale stock lots</strong> corresponding to your active Want-To-Buy (WTB) procurement requests on B2B LINK.
    </p>

    <!-- Important Login & Privacy Callout -->
    <div style="background-color: #f8fafc; border-left: 4px solid #0A6CFF; padding: 14px 18px; border-radius: 8px; margin: 18px 0 20px 0;">
      <p style="font-size: 13px; color: #1e293b; margin: 0; line-height: 1.5; font-weight: 600;">
        🔒 <strong>Commercial Details Protected:</strong> To preserve confidential trading terms, counterparty company identities, and wholesale pricing, full details are exclusively accessible inside your secure portal. Please log in to your B2B LINK account to view full match specifications, unlock supplier contacts, and initiate direct trade negotiations.
      </p>
    </div>

    <!-- Stock Matches Table -->
    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 24px 0 8px 0;">
      MATCHED STOCK LIST (${count} ITEMS)
    </div>
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0; text-align: left;">
            <th style="padding: 10px 8px; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; width: 34px; text-align: center;">#</th>
            <th style="padding: 10px 8px; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase;">Stock Item / Model</th>
            <th style="padding: 10px 8px; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; text-align: right; width: 85px;">Volume</th>
            <th style="padding: 10px 8px; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; width: 110px;">Barcode / SKU</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div style="background-color: #F3F6FB; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="font-size: 13.5px; font-weight: 700; color: #0b1f3a; margin: 0 0 4px 0;">
        Ready to review all ${count} matches and connect with suppliers?
      </p>
      <p style="font-size: 12.5px; color: #5B6B82; margin: 0; line-height: 1.5;">
        Log in to your B2B LINK Trading Workspace to unlock full pricing, request quotes, or message suppliers directly.
      </p>
    </div>

    <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
      Kind regards,<br />
      <strong>B2B LINK Trading Desk</strong>
    </div>
  `;

  const html = emailWrapper(
    subject,
    `${count} STOCK MATCHES`,
    content,
    actionUrl,
    `Log In & View All ${count} Matches`
  );

  return { subject, html };
}

async function main() {
  const targetEmail = 'huzaifaf558@gmail.com';
  const actionUrl = 'https://b2blink.eu/dashboard?matchTab=true';
  const { subject, html } = buildConsolidatedEmail('Huzaifa Faisal', sample100Items, actionUrl);

  // Write preview HTML to brain artifact folder
  const artifactDir = 'C:/Users/Daddy/.gemini/antigravity/brain/721f81bb-98c5-4881-b134-c4b1a9e1e7b1';
  const previewPath = path.join(artifactDir, '100_items_match_email_preview.html');
  fs.writeFileSync(previewPath, html, 'utf8');
  console.log('Saved 100-item email preview HTML to:', previewPath);

  // Dispatch live email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log(`Dispatching live 100-item consolidated match email to ${targetEmail}...`);

  try {
    const plainText = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&bull;/g, '•')
      .replace(/&rarr;/g, '->')
      .replace(/\s+/g, ' ')
      .trim();

    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'B2B LINK <notifications@brandnova.info>',
      to: targetEmail,
      reply_to: 'trading@b2blink.eu',
      subject,
      html,
      text: plainText,
    });

    console.log('=== RESEND DISPATCH RESPONSE ===');
    console.log(JSON.stringify(response, null, 2));

    if (response.data && response.data.id) {
      console.log('SUCCESS: Email successfully accepted by Resend with ID:', response.data.id);
    } else if (response.error) {
      console.warn('NOTICE: Resend returned error:', response.error);
    }
  } catch (err) {
    console.error('EXCEPTION during Resend dispatch:', err.message);
  }
}

main();

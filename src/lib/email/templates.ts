export interface NewInquiryEmailProps {
  sellerName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  productTitle: string;
  targetQuantity: number;
  offeredPrice?: number | null;
  message: string;
  actionUrl: string;
}

export interface NicheWtbAlertEmailProps {
  sellerName: string;
  productName: string;
  categoryName: string;
  targetQuantity: number;
  targetPrice: number;
  actionUrl: string;
}

export interface ExactBarcodeMatchEmailProps {
  sellerName: string;
  productName: string;
  barcodeOrSku: string;
  targetQuantity: number;
  targetPrice: number;
  actionUrl: string;
}

export interface QuoteReceivedEmailProps {
  buyerName: string;
  productName: string;
  sellerCompanyName: string;
  unitPrice: number;
  totalPrice?: number | null;
  quantityOffered: number;
  leadTimeDays?: number | null;
  notes?: string | null;
  actionUrl: string;
}

export interface VettingDecisionEmailProps {
  companyName: string;
  decision: 'approved' | 'rejected';
  notes?: string | null;
  actionUrl: string;
}

export interface PasswordResetEmailProps {
  recipientEmail: string;
  actionUrl: string;
}

export interface VerificationEmailProps {
  recipientEmail: string;
  contactName?: string;
  otpCode: string;
  actionUrl: string;
}

function emailWrapper(title: string, badge: string, content: string, ctaUrl: string, ctaText: string): string {
  const logoUrl = 'https://qmosgopkjqrqogsdgwuy.supabase.co/storage/v1/object/public/public-assets/b2b-link-logo-tight.png';

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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #EAEFF6; box-shadow: 0 10px 30px rgba(11, 31, 58, 0.06); overflow: hidden;">
          
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
                    <span style="display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background-color: #EBF3FF; color: #0A6CFF; border: 1px solid #D0E2FF;">
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
                Europe&rsquo;s verified wholesale trading network &bull; 0% transaction commission
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

/**
 * 1. Sent to seller when a buyer submits a product inquiry.
 */
export function newInquiryEmail(props: NewInquiryEmailProps): { subject: string; html: string } {
  const subject = `[New Inquiry] ${props.buyerName} is interested in "${props.productTitle}"`;

  const content = `
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Hello ${props.sellerName},</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
      A qualified buyer has just submitted an inquiry for your listing on B2B LINK. Review their specifications below and respond promptly to secure the trade.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;">Product:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${props.productTitle}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Buyer:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${props.buyerName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Buyer Email:</td>
          <td style="padding: 6px 0; color: #2563eb;">${props.buyerEmail}</td>
        </tr>
        ${
          props.buyerPhone
            ? `<tr>
                <td style="padding: 6px 0; color: #64748b;">Buyer Phone:</td>
                <td style="padding: 6px 0; color: #0f172a;">${props.buyerPhone}</td>
              </tr>`
            : ''
        }
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Target Quantity:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${props.targetQuantity.toLocaleString()} units</td>
        </tr>
        ${
          props.offeredPrice !== undefined && props.offeredPrice !== null
            ? `<tr>
                <td style="padding: 6px 0; color: #64748b;">Offered Price:</td>
                <td style="padding: 6px 0; color: #16a34a; font-weight: 600;">$${props.offeredPrice.toFixed(2)} / unit</td>
              </tr>`
            : ''
        }
      </table>
    </div>

    <div style="margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.05em;">Message from Buyer:</div>
      <div style="background-color: #ffffff; border-left: 3px solid #2563eb; padding: 12px 16px; font-size: 14px; font-style: italic; color: #334155; line-height: 1.6; background-color: #f1f5f9; border-radius: 0 6px 6px 0;">
        "${props.message}"
      </div>
    </div>
  `;

  return {
    subject,
    html: emailWrapper('New Product Inquiry', 'New Inquiry', content, props.actionUrl, 'View Inquiry & Reply'),
  };
}

/**
 * 2. Sent to sellers when a new WTB request is posted in their niche.
 */
export function nicheWtbAlertEmail(props: NicheWtbAlertEmailProps): { subject: string; html: string } {
  const subject = `[WTB Opportunity] New Request in ${props.categoryName}: ${props.productName}`;

  const content = `
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Hello ${props.sellerName},</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
      A buyer on B2B LINK has just published a <strong>Want To Buy (WTB)</strong> request matching your category niche (<strong>${props.categoryName}</strong>).
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;">Item Requested:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 15px;">${props.productName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Niche / Category:</td>
          <td style="padding: 6px 0; color: #2563eb; font-weight: 600;">${props.categoryName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Target Volume:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${props.targetQuantity.toLocaleString()} units</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Target Unit Price:</td>
          <td style="padding: 6px 0; color: #16a34a; font-weight: 700; font-size: 15px;">$${props.targetPrice.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
      As a vetted seller in this category, you can submit a direct quote to fulfill this order before competitors jump in.
    </p>
  `;

  return {
    subject,
    html: emailWrapper('New WTB Request in Your Niche', 'Niche Alert', content, props.actionUrl, 'Submit Quotation Now'),
  };
}

/**
 * 3. High-priority alert sent to sellers when a WTB matches their exact product barcode.
 */
export function exactBarcodeMatchEmail(props: ExactBarcodeMatchEmailProps): { subject: string; html: string } {
  const subject = `[EXACT MATCH] Buyer needs Barcode/SKU: ${props.barcodeOrSku}`;

  const content = `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <span style="font-weight: 700; color: #b91c1c; font-size: 14px;">🎯 Exact Barcode Match Detected</span>
      <p style="font-size: 13px; color: #991b1b; margin: 4px 0 0 0;">
        A buyer posted a WTB request with the exact barcode or SKU you actively hold in inventory.
      </p>
    </div>

    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Hello ${props.sellerName},</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
      A buyer is looking for the exact product line you list: <strong>${props.productName}</strong>.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;">Barcode / SKU:</td>
          <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 15px; font-weight: 700; color: #2563eb;">
            ${props.barcodeOrSku}
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Target Volume:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${props.targetQuantity.toLocaleString()} units</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Target Price:</td>
          <td style="padding: 6px 0; color: #16a34a; font-weight: 700; font-size: 16px;">$${props.targetPrice.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #64748b; margin: 0;">
      This match has been routed directly to your account. Submit your quote to secure first-look buyer acceptance.
    </p>
  `;

  return {
    subject,
    html: emailWrapper('Exact Barcode Match Alert', 'High Priority', content, props.actionUrl, 'Review Request & Quote'),
  };
}

/**
 * 4. Sent to buyer when a seller submits a quotation on their WTB request.
 */
export function quoteReceivedEmail(props: QuoteReceivedEmailProps): { subject: string; html: string } {
  const subject = `[Quote Received] ${props.sellerCompanyName} quoted your request for "${props.productName}"`;

  const totalPrice =
    props.totalPrice ?? props.unitPrice * props.quantityOffered;

  const content = `
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Hello ${props.buyerName},</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
      A verified seller has submitted an official quotation for your WTB request on <strong>${props.productName}</strong>.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;">Seller:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${props.sellerCompanyName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Offered Unit Price:</td>
          <td style="padding: 6px 0; color: #16a34a; font-weight: 700; font-size: 16px;">$${props.unitPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Quantity Offered:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${props.quantityOffered.toLocaleString()} units</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Estimated Total:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">$${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
        ${
          props.leadTimeDays
            ? `<tr>
                <td style="padding: 6px 0; color: #64748b;">Lead Time:</td>
                <td style="padding: 6px 0; color: #0f172a;">${props.leadTimeDays} business days</td>
              </tr>`
            : ''
        }
      </table>
    </div>

    ${
      props.notes
        ? `<div style="margin-bottom: 24px;">
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Seller Notes & Terms:</div>
            <div style="background-color: #f1f5f9; border-left: 3px solid #10b981; padding: 12px 16px; font-size: 14px; color: #334155; border-radius: 0 6px 6px 0;">
              ${props.notes}
            </div>
          </div>`
        : ''
    }
  `;

  return {
    subject,
    html: emailWrapper('New Quotation Received', 'Quotation Received', content, props.actionUrl, 'Review Quote Details'),
  };
}

/**
 * 5. Sent to seller when approved or rejected by Jeff.
 */
export function vettingDecisionEmail(props: VettingDecisionEmailProps): { subject: string; html: string } {
  const isApproved = props.decision === 'approved';
  const subject = isApproved
    ? `[B2B LINK] Welcome! Your Seller Account has been Approved by Jeff`
    : `[B2B LINK] Update regarding your Seller Application`;

  const bannerColor = isApproved ? '#ecfdf5' : '#fff1f2';
  const borderColor = isApproved ? '#a7f3d0' : '#fecdd3';
  const textColor = isApproved ? '#065f46' : '#9f1239';

  const content = `
    <div style="background-color: ${bannerColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
      <h3 style="margin: 0; color: ${textColor}; font-size: 16px; font-weight: 700;">
        ${isApproved ? '🎉 Congratulations! Your application has been approved.' : 'Application Status Update'}
      </h3>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textColor}; line-height: 1.5;">
        ${
          isApproved
            ? 'Jeff and the B2B LINK desk have reviewed and certified your wholesale credentials.'
            : 'Jeff and the compliance team have completed their review of your wholesale account.'
        }
      </p>
    </div>

    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Hello ${props.companyName},</h2>

    ${
      isApproved
        ? `<p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            You now have full verified access to the platform. You can immediately begin listing inventory, responding to buyer inquiries, and quoting on active WTB boards in your categories.
          </p>
          <ul style="font-size: 14px; color: #334155; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
            <li>Publish products to verified wholesale buyers</li>
            <li>Receive real-time WTB alerts matching your catalog & barcodes</li>
            <li>Access direct quote submission tools</li>
          </ul>`
        : `<p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            Unfortunately, your seller application could not be approved at this time.
          </p>
          ${
            props.notes
              ? `<div style="background-color: #f8fafc; border-left: 3px solid #ef4444; padding: 12px 16px; font-size: 14px; color: #334155; margin-bottom: 24px;">
                  <strong>Reason / Reviewer Notes:</strong><br/>
                  ${props.notes}
                </div>`
              : ''
          }
          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 20px 0;">
            If you believe this is in error or have updated credentials to provide, please reply directly to Jeff at our verification desk.
          </p>`
    }
  `;

  return {
    subject,
    html: emailWrapper(
      isApproved ? 'Seller Account Approved' : 'Application Decision',
      isApproved ? 'Approved' : 'Review Decision',
      content,
      props.actionUrl,
      isApproved ? 'Open Seller Dashboard' : 'View Account Details'
    ),
  };
}

/**
 * 6. Sent to user when requesting a password reset.
 */
export function passwordResetEmail(props: PasswordResetEmailProps): { subject: string; html: string } {
  const subject = 'Reset your password - B2B LINK OÜ';

  const content = `
    <h1 style="font-size: 26px; font-weight: 800; color: #0B1F3A; letter-spacing: -0.025em; margin: 0 0 12px 0; line-height: 1.2;">
      Reset your password
    </h1>

    <p style="font-size: 15px; line-height: 1.6; color: #5B6B82; margin: 0 0 16px 0;">
      We received a request to reset the password for your account associated with <strong>${props.recipientEmail}</strong>.
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #5B6B82; margin: 0 0 24px 0;">
      Click the button below to choose a new password. For security, this link expires in 1 hour.
    </p>

    <div style="background-color: #F8FAFC; border-left: 3px solid #0A6CFF; padding: 12px 16px; font-size: 13px; color: #5B6B82; margin-top: 24px; border-radius: 6px;">
      If you did not request a password reset, you can safely ignore this email. Your account credentials remain secure.
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Reset Password Request',
      'PASSWORD RECOVERY',
      content,
      props.actionUrl,
      'Reset Password'
    ),
  };
}

/**
 * 7. Sent to user upon registration to confirm corporate email address.
 */
export function verificationEmail(props: VerificationEmailProps): { subject: string; html: string } {
  const subject = 'Verify your email address - B2B LINK OÜ';
  const nameGreeting = props.contactName ? `Hello ${props.contactName},` : 'Hello,';

  const content = `
    <h1 style="font-size: 26px; font-weight: 800; color: #0B1F3A; letter-spacing: -0.025em; margin: 0 0 12px 0; line-height: 1.2;">
      Verify your email address
    </h1>

    <p style="font-size: 15px; line-height: 1.6; color: #5B6B82; margin: 0 0 20px 0;">
      ${nameGreeting} welcome to <strong>B2B LINK OÜ</strong>. To activate your wholesale trading account and access Europe's verified network, please enter this code on the verification screen:
    </p>

    <div style="background-color: #F8FAFF; border: 2px dashed #0A6CFF; border-radius: 16px; padding: 26px 20px; text-align: center; margin: 24px 0;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #0A6CFF; margin-bottom: 8px;">
        YOUR VERIFICATION CODE
      </div>
      <div style="font-size: 36px; font-weight: 800; letter-spacing: 0.25em; color: #0B1F3A; font-family: 'Manrope', monospace; line-height: 1.2;">
        ${props.otpCode}
      </div>
      <div style="font-size: 12px; color: #8A9BB0; margin-top: 10px; font-weight: 500;">
        Valid for 15 minutes &bull; Enter this code on the verification screen
      </div>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #5B6B82; margin: 0 0 16px 0; text-align: center;">
      Or click the button below to verify instantly in your browser:
    </p>

    <div style="background-color: #F8FAFC; border-left: 3px solid #0A6CFF; padding: 12px 16px; font-size: 13px; color: #5B6B82; margin-top: 24px; border-radius: 6px;">
      If you did not register on B2B LINK OÜ, you can safely ignore this email.
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Verify Corporate Email',
      'ACCOUNT VERIFICATION',
      content,
      props.actionUrl,
      'Verify Email Address'
    ),
  };
}



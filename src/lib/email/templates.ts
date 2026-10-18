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

export interface KycVerificationRequestEmailProps {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  actionUrl: string;
}

export interface AccountApprovalEmailProps {
  companyName: string;
  contactName: string;
  actionUrl: string;
}

export interface MembershipUpgradeEmailProps {
  companyName: string;
  contactName: string;
  tier: 'silver' | 'gold';
  price: number;
  cardLast4?: string;
  actionUrl: string;
}

export interface AccountSuspendedEmailProps {
  companyName: string;
  contactName?: string;
  reason?: string;
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
    ? `[B2B LINK] Welcome! Your Account Has Been Verified`
    : `[B2B LINK] Update Regarding Your B2B LINK Account`;

  const bannerColor = isApproved ? '#ecfdf5' : '#fff1f2';
  const borderColor = isApproved ? '#a7f3d0' : '#fecdd3';
  const textColor = isApproved ? '#065f46' : '#9f1239';

  const content = `
    <div style="background-color: ${bannerColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
      <h3 style="margin: 0; color: ${textColor}; font-size: 16px; font-weight: 700;">
        ${isApproved ? '🎉 Congratulations! Your business verification has been completed.' : 'Account Status: Under Review'}
      </h3>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textColor}; line-height: 1.5;">
        ${
          isApproved
            ? 'The B2B LINK Verification Team has reviewed and confirmed your company verification.'
            : 'The B2B LINK Verification Team has reviewed your account status.'
        }
      </p>
    </div>

    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Hello ${props.companyName},</h2>

    ${
      isApproved
        ? `<p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            We are pleased to confirm that the business verification for ${props.companyName} has been completed. Your account is now active and your company has Verified Member status on B2B LINK.
          </p>
          <ul style="font-size: 14px; color: #334155; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
            <li>Browse live BUY and SELL listings</li>
            <li>Post and manage your own BUY and SELL requirements</li>
            <li>Receive relevant Buyer-Seller Matches</li>
            <li>Search for products and trading opportunities</li>
            <li>Connect directly with other members</li>
          </ul>
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            You can log in to your account to get started.<br /><br />
            Welcome to B2B LINK.<br /><br />
            Kind regards,<br />
            <strong>B2B LINK Verification Team</strong>
          </p>`
        : `<p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            We are contacting you regarding the B2B LINK account for ${props.companyName}.
          </p>
          <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 14px; color: #9f1239;">
            <strong>Account Status: Under Review</strong>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            We require additional information before we can complete the verification of your account. Please reply to this email with any information requested by our Verification Team.
          </p>
          ${
            props.notes
              ? `<div style="background-color: #f8fafc; border-left: 3px solid #ef4444; padding: 12px 16px; font-size: 14px; color: #334155; margin-bottom: 24px;">
                  <strong>Reviewer Notes:</strong><br/>
                  ${props.notes}
                </div>`
              : ''
          }
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            Once the required information has been received, we will continue our review and update you as soon as possible.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            Kind regards,<br />
            <strong>B2B LINK Verification Team</strong>
          </p>`
    }
  `;

  return {
    subject,
    html: emailWrapper(
      isApproved ? 'Account Verified' : 'Account Under Review',
      isApproved ? 'VERIFIED MEMBER' : 'UNDER REVIEW',
      content,
      props.actionUrl,
      isApproved ? 'Log In to Account' : 'View Account Details'
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

export interface PasswordResetOtpEmailProps {
  recipientEmail: string;
  otpCode: string;
  contactName?: string;
  actionUrl?: string;
}

/**
 * 6B. Sent to user when requesting a password reset verification code.
 */
export function passwordResetOtpEmail(props: PasswordResetOtpEmailProps): { subject: string; html: string } {
  const subject = `${props.otpCode} is your B2B LINK password reset verification code`;
  const nameGreeting = props.contactName ? `Hello ${props.contactName},` : 'Hello,';

  const content = `
    <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; letter-spacing: -0.025em; margin: 0 0 12px 0; line-height: 1.25;">
      Password Reset Verification Code
    </h1>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      ${nameGreeting}
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
      We received a request to reset the password for your account associated with <strong>${props.recipientEmail}</strong>.
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Please enter the following 6-digit verification code to choose a new password:
    </p>

    <div style="background-color: #F8FAFF; border: 2px dashed #0A6CFF; border-radius: 16px; padding: 24px 20px; text-align: center; margin: 20px 0;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #0A6CFF; margin-bottom: 8px;">
        VERIFICATION CODE
      </div>
      <div style="font-size: 36px; font-weight: 800; letter-spacing: 0.25em; color: #0B1F3A; font-family: monospace; line-height: 1.2;">
        ${props.otpCode}
      </div>
      <div style="font-size: 12px; color: #64748B; margin-top: 10px; font-weight: 500;">
        This code is valid for 15 minutes.
      </div>
    </div>

    <p style="font-size: 13px; line-height: 1.6; color: #64748B; margin: 20px 0 0 0;">
      If you did not request a password reset, you can safely ignore this email. Your account credentials remain secure.
    </p>

    <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
      Kind regards,<br />
      <strong>B2B LINK Support Desk</strong>
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Password Reset Verification',
      'PASSWORD RESET',
      content,
      props.actionUrl || 'https://b2blink.eu/reset-password',
      'Reset Password'
    ),
  };
}

/**
 * 7. Sent to user upon registration to confirm corporate email address.
 */
/**
 * 7. (Message 1) Email Verification
 * Trigger Event: User submits the registration form
 * Recipient: Registered business email address
 * Subject: Verify Your Email Address - B2B LINK
 */
export function verificationEmail(props: VerificationEmailProps): { subject: string; html: string } {
  const subject = 'Verify Your Email Address - B2B LINK';
  const nameGreeting = props.contactName ? `Hello ${props.contactName},` : 'Hello,';

  const content = `
    <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; letter-spacing: -0.025em; margin: 0 0 12px 0; line-height: 1.25;">
      Verify Your Email Address
    </h1>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      ${nameGreeting}
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
      Welcome to B2B LINK.
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      To verify your email address and continue setting up your account, please enter the following verification code:
    </p>

    <div style="background-color: #F8FAFF; border: 2px dashed #0A6CFF; border-radius: 16px; padding: 24px 20px; text-align: center; margin: 20px 0;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #0A6CFF; margin-bottom: 8px;">
        VERIFICATION CODE
      </div>
      <div style="font-size: 34px; font-weight: 800; letter-spacing: 0.25em; color: #0B1F3A; font-family: 'Manrope', monospace; line-height: 1.2;">
        ${props.otpCode}
      </div>
      <div style="font-size: 12px; color: #64748B; margin-top: 10px; font-weight: 500;">
        This code is valid for 15 minutes.
      </div>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Alternatively, click the button below to verify your email address:
    </p>

    <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
      Kind regards,<br />
      <strong>B2B LINK Support Team</strong>
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Verify Your Email Address',
      'EMAIL VERIFICATION',
      content,
      props.actionUrl,
      'Verify Email Address'
    ),
  };
}

/**
 * 8. (Message 2) Business Verification Request
 * Trigger Event: Sent after the business email address has been verified
 * Recipient: Registered customer contact email
 * Subject: Action Required: Complete Your B2B LINK Business Verification
 */
export function kycVerificationRequestEmail(
  props: KycVerificationRequestEmailProps
): { subject: string; html: string } {
  const subject = 'Action Required: Submit verification documents to activate your account - B2B LINK';
  const nameGreeting = props.contactName ? `Hello ${props.contactName},` : 'Hello,';

  const content = `
    <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; letter-spacing: -0.025em; margin: 0 0 14px 0; line-height: 1.25;">
      Complete Your B2B LINK Business Verification
    </h1>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      ${nameGreeting}
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Thank you for registering <strong>${props.companyName}</strong> with B2B LINK.
    </p>

    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 14px; padding: 16px 18px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: 800; color: #B45309; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">
        Account Status: Pending Document Verification
      </div>
      <p style="font-size: 14px; line-height: 1.5; color: #92400E; margin: 0;">
        Your email address has been verified. Because initial registration on B2B LINK requires only minimal information, we require official business documentation to verify your company identity, maintain trading security, and activate full wholesale platform access.
      </p>
    </div>

    <h3 style="font-size: 16px; font-weight: 800; color: #0B1F3A; margin: 24px 0 14px 0; letter-spacing: -0.01em;">
      Required Wholesale Documents Checklist (Please Provide All 4):
    </h3>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
      <tr>
        <td style="padding: 12px 16px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
          <div style="font-size: 14px; font-weight: 700; color: #0B1F3A;">1. Certificate of Incorporation / Company Registration</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 3px; line-height: 1.4;">Official government proof of registered business entity (Companies House, Commercial Register / Handelsregister, or national equivalent).</div>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
          <div style="font-size: 14px; font-weight: 700; color: #0B1F3A;">2. VAT / Tax Registration Certificate</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 3px; line-height: 1.4;">Valid national tax authority registration document or VAT certificate.</div>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
          <div style="font-size: 14px; font-weight: 700; color: #0B1F3A;">3. Proof of Registered Business / Trading Address</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 3px; line-height: 1.4;">Recent utility bill, lease agreement, or corporate bank statement (dated within the last 90 days) displaying your company name and address.</div>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
          <div style="font-size: 14px; font-weight: 700; color: #0B1F3A;">4. Wholesale Trade Invoices or Authorized Distributor Invoices</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 3px; line-height: 1.4;">Recent commercial purchase invoices from official manufacturers, brand distributors, or wholesale trade references demonstrating active trading operations.</div>
        </td>
      </tr>
    </table>

    <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 14px; padding: 18px 20px; margin: 22px 0;">
      <div style="font-size: 12px; font-weight: 800; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
        How to Submit Your 4 Documents:
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #1E3A8A; margin: 0 0 10px 0;">
        &bull; <strong>Option 1 (Fastest):</strong> Simply <strong>reply directly to this email</strong> with your PDF, scanned, or image files attached.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #1E3A8A; margin: 0;">
        &bull; <strong>Option 2:</strong> Email your documents directly to <a href="mailto:newcustomers@brandnova.info" style="color: #0A6CFF; font-weight: 700; text-decoration: underline;">newcustomers@brandnova.info</a> (or <a href="mailto:newcustomers@b2blink.eu" style="color: #0A6CFF; font-weight: 700; text-decoration: underline;">newcustomers@b2blink.eu</a>) with your company name (<strong>${props.companyName}</strong>) in the subject line.
      </p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Our Verification Team reviews all submitted documents promptly. Your account will remain in Pending Verification status until the review is completed, after which you will receive an automated confirmation email activating full trading access.
    </p>

    <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
      Kind regards,<br />
      <strong>B2B LINK Verification Team</strong>
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Business Verification Documents Required',
      'ACTION REQUIRED',
      content,
      props.actionUrl,
      'View Verification Status'
    ),
  };
}

// Alias for clean naming
export const businessVerificationRequestEmail = kycVerificationRequestEmail;

/**
 * 9. (Message 3) New Member Verification - Internal Admin Alert
 * Trigger Event: Generated automatically when a new company registers
 * Recipient: Internal B2B LINK administration / verification queue
 * Subject: New Member Verification Required - [Company Name]
 */
export function adminNewCustomerAlertEmail(props: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  role?: string;
  actionUrl: string;
}): { subject: string; html: string } {
  const subject = `New Member Verification Required - ${props.companyName}`;

  const content = `
    <h1 style="font-size: 22px; font-weight: 800; color: #0B1F3A; margin: 0 0 12px 0;">
      New Member Verification Required
    </h1>
    <p style="font-size: 14px; color: #334155; margin: 0 0 20px 0;">
      A new company has registered with B2B LINK and is awaiting verification.
    </p>

    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; margin-bottom: 24px; font-size: 14px;">
      <div style="margin-bottom: 8px;"><strong>Company:</strong> ${props.companyName}</div>
      <div style="margin-bottom: 8px;"><strong>Contact:</strong> ${props.contactName}</div>
      <div style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:${props.email}" style="color: #0A6CFF; text-decoration: none;">${props.email}</a></div>
      <div style="margin-bottom: 8px;"><strong>Telephone:</strong> ${props.phone || 'Not provided'}</div>
      <div style="margin-bottom: 8px;"><strong>Country:</strong> ${props.country || 'Global'}</div>
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-weight: 700; color: #B45309;">
        Current Status: Pending Verification
      </div>
    </div>

    <p style="font-size: 13px; color: #64748B;">
      Please review the company information in the Admin Panel and complete the required verification checks.
    </p>
  `;

  return {
    subject,
    html: emailWrapper(
      'New Member Verification Required',
      'VERIFICATION QUEUE',
      content,
      props.actionUrl,
      'Open Admin Panel'
    ),
  };
}

export const newMemberVerificationAdminEmail = adminNewCustomerAlertEmail;

/**
 * 10. (Message 4) Account Verified
 * Trigger Event: Sent when the Verification Team activates the member account
 * Recipient: Customer business email address
 * Subject: Your B2B LINK Account Has Been Verified
 */
export function accountApprovalEmail(props: AccountApprovalEmailProps): { subject: string; html: string } {
  const subject = 'Your B2B LINK Account Has Been Verified';
  const nameGreeting = props.contactName ? `Hello ${props.contactName},` : 'Hello,';

  const content = `
    <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; margin: 0 0 12px 0;">
      Your Account Has Been Verified
    </h1>
    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      ${nameGreeting}
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      We are pleased to confirm that the business verification for <strong>${props.companyName}</strong> has been completed.
    </p>

    <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
      <p style="font-size: 14px; line-height: 1.5; color: #065F46; margin: 0; font-weight: 700;">
        Your account is now active and your company has Verified Member status on B2B LINK.
      </p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
      You can now access the features available under your membership, including:
    </p>

    <ul style="font-size: 14px; color: #334155; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
      <li>Browse live BUY and SELL listings</li>
      <li>Post and manage your own BUY and SELL requirements</li>
      <li>Receive relevant Buyer-Seller Matches</li>
      <li>Search for products and trading opportunities</li>
      <li>Connect directly with other members</li>
    </ul>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      You can log in to your account to get started.
    </p>

    <p style="font-size: 15px; line-height: 1.6; font-weight: 700; color: #0B1F3A; margin: 0 0 20px 0;">
      Welcome to B2B LINK.
    </p>

    <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
      Kind regards,<br />
      <strong>B2B LINK Verification Team</strong>
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Account Verified',
      'VERIFIED MEMBER',
      content,
      props.actionUrl,
      'Log In to Your Account'
    ),
  };
}

export const accountVerifiedEmail = accountApprovalEmail;

/**
  * Membership Plan Upgrade Confirmation Email
  * Trigger Event: Sent when a member upgrades to Silver or Gold tier
  * Recipient: Customer business email address
  * Subject: [B2B LINK] Membership Upgraded to [Tier]
  */
export function membershipUpgradeEmail(props: MembershipUpgradeEmailProps): { subject: string; html: string } {
  const isGold = props.tier.toLowerCase() === 'gold';
  const tierName = isGold ? 'Gold VIP Tier' : 'Silver Tier';
  const subject = `[B2B LINK] Membership Upgraded to ${tierName}`;
  const nameGreeting = props.contactName ? `Hello ${props.contactName},` : 'Hello,';

  const content = `
    <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; margin: 0 0 12px 0;">
      🎉 Membership Upgraded: Welcome to ${tierName}
    </h1>
    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      ${nameGreeting}
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Your B2B LINK membership for <strong>${props.companyName}</strong> has been successfully upgraded to <strong>${tierName}</strong>.
    </p>

    <div style="background-color: ${isGold ? '#FFFBEB' : '#EFF6FF'}; border: 1px solid ${isGold ? '#FDE68A' : '#BFDBFE'}; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
      <p style="font-size: 14px; line-height: 1.5; color: ${isGold ? '#92400E' : '#1E40AF'}; margin: 0; font-weight: 700;">
        Plan: ${tierName} • £${props.price}/month • Auto-renewing monthly via card ending in ${props.cardLast4 || '4242'}
      </p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
      Your new membership tier perks are now active across your entire account:
    </p>

    <ul style="font-size: 14px; color: #334155; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
      ${
        isGold
          ? `<li><strong>Internal Network Broadcasts (WTB & WTS)</strong>: Instantly broadcast want-to-buy and want-to-sell offers to all verified platform members</li>
             <li><strong>Unlimited Direct Contact Unlocks</strong>: View supplier contacts, WhatsApp details & phone numbers without restrictions</li>
             <li><strong>Unlimited Product Listings</strong> with Priority Spotlight & Hot placement</li>
             <li><strong>Verified EU Gold Supplier Badge</strong> on your profile and listings</li>
             <li>Dedicated Account Manager & Priority RFQ Support</li>`
          : `<li><strong>20 Direct Contact Unlocks</strong> per month</li>
             <li><strong>50 Active Product Listings</strong></li>
             <li><strong>CSV Bulk Catalog Import</strong></li>
             <li>Direct supplier WhatsApp & phone access</li>`
      }
    </ul>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      You can access your upgraded features immediately from your seller dashboard.
    </p>

    <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
      Kind regards,<br />
      <strong>B2B LINK Accounts & Billing Team</strong>
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Membership Upgraded',
      tierName.toUpperCase(),
      content,
      props.actionUrl,
      'Go to Seller Dashboard'
    ),
  };
}

/**
 * 11. (Message 5) Account Under Review / Suspended
 * Trigger Event: Sent when additional verification information is required, or when an active account is placed under review
 * Recipient: Customer business email address
 * Subject: Update Regarding Your B2B LINK Account
 */
export function accountSuspendedEmail(props: AccountSuspendedEmailProps & { status?: 'under_review' | 'suspended' }): { subject: string; html: string } {
  const subject = 'Update Regarding Your B2B LINK Account';
  const nameGreeting = props.contactName ? `Hello ${props.contactName},` : 'Hello,';
  const isSuspended = props.status === 'suspended';

  const content = isSuspended
    ? `
      <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; margin: 0 0 12px 0;">
        Update Regarding Your B2B LINK Account
      </h1>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
        ${nameGreeting}
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        We are contacting you regarding the B2B LINK account for <strong>${props.companyName}</strong>.
      </p>

      <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 800; color: #991B1B; margin-bottom: 6px;">
          Account Status: Suspended
        </div>
        <p style="font-size: 14px; line-height: 1.5; color: #B91C1C; margin: 0;">
          ${props.reason || 'Your B2B LINK account has been temporarily suspended while we review an account or verification matter. Please contact the B2B LINK Verification Team for further information.'}
        </p>
      </div>

      <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
        Kind regards,<br />
        <strong>B2B LINK Verification Team</strong>
      </div>
    `
    : `
      <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; margin: 0 0 12px 0;">
        Update Regarding Your B2B LINK Account
      </h1>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
        ${nameGreeting}
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        We are contacting you regarding the B2B LINK account for <strong>${props.companyName}</strong>.
      </p>

      <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 800; color: #B45309; margin-bottom: 6px;">
          Account Status: Under Review
        </div>
        <p style="font-size: 14px; line-height: 1.5; color: #92400E; margin: 0;">
          We require additional information before we can complete the verification of your account.
        </p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
        Please reply to this email with any information requested by our Verification Team.
      </p>

      ${
        props.reason
          ? `<div style="background-color: #F8FAFC; border-left: 3px solid #F59E0B; padding: 12px 16px; font-size: 14px; color: #334155; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
              <strong>Verification Request Details:</strong><br/>
              ${props.reason}
            </div>`
          : ''
      }

      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        Once the required information has been received, we will continue our review and update you as soon as possible.
      </p>

      <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
        Kind regards,<br />
        <strong>B2B LINK Verification Team</strong>
      </div>
    `;

  return {
    subject,
    html: emailWrapper(
      'Update Regarding Your B2B LINK Account',
      isSuspended ? 'SUSPENDED' : 'UNDER REVIEW',
      content,
      props.actionUrl,
      'Contact Verification Team'
    ),
  };
}

export const accountUnderReviewEmail = accountSuspendedEmail;

export interface CustomerQueryReplyEmailProps {
  customerName: string;
  companyName: string;
  subject?: string;
  replyMessage: string;
  originalMessage?: string;
  actionUrl?: string;
}

/**
 * 12. (Message 8) Customer Support Reply
 * Trigger Event: Sent when B2B LINK replies to a customer enquiry
 * Recipient: Prospective or registered customer email address
 * Subject: Response from B2B LINK Support
 */
export function customerQueryReplyEmail(props: CustomerQueryReplyEmailProps): {
  subject: string;
  html: string;
} {
  const subject = props.subject || 'Response from B2B LINK Support';
  const nameGreeting = props.customerName ? `Hello ${props.customerName},` : 'Hello,';
  const formattedReply = props.replyMessage.replace(/\n/g, '<br />');
  const formattedOriginal = props.originalMessage ? props.originalMessage.replace(/\n/g, '<br />') : null;

  const content = `
    <h1 style="font-size: 24px; font-weight: 800; color: #0B1F3A; margin: 0 0 12px 0;">
      Response from B2B LINK Support
    </h1>
    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      ${nameGreeting}
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Thank you for contacting B2B LINK.
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Our Support Team has reviewed your enquiry regarding <strong>${props.companyName}</strong>.
    </p>

    <!-- Support Reply Body -->
    <div style="margin-bottom: 20px;">
      <div style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
        Our response:
      </div>
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #0A6CFF; border-radius: 12px; padding: 20px; font-size: 14px; line-height: 1.7; color: #1E293B;">
        ${formattedReply}
      </div>
    </div>

    ${
      formattedOriginal
        ? `
      <div style="margin-top: 24px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
          Your original enquiry:
        </div>
        <div style="font-size: 13px; line-height: 1.6; color: #64748B; background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 14px;">
          ${formattedOriginal}
        </div>
      </div>
    `
        : ''
    }

    <p style="font-size: 14px; color: #334155; margin-top: 20px; line-height: 1.6;">
      You can reply directly to this email if you require any further assistance.
    </p>

    <div style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
      Kind regards,<br />
      <strong>B2B LINK Support Team</strong>
    </div>
  `;

  return {
    subject,
    html: emailWrapper(
      'Response from B2B LINK Support',
      'CUSTOMER SUPPORT',
      content,
      props.actionUrl || 'https://b2blink.eu/contact',
      'Visit Support Desk'
    ),
  };
}

export const customerSupportReplyEmail = customerQueryReplyEmail;



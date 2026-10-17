import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server';
import {
  newInquiryEmail,
  nicheWtbAlertEmail,
  exactBarcodeMatchEmail,
  quoteReceivedEmail,
  vettingDecisionEmail,
  passwordResetEmail,
  verificationEmail,
  kycVerificationRequestEmail,
  adminNewCustomerAlertEmail,
  accountApprovalEmail,
  accountSuspendedEmail,
  type NewInquiryEmailProps,
  type NicheWtbAlertEmailProps,
  type ExactBarcodeMatchEmailProps,
  type QuoteReceivedEmailProps,
  type VettingDecisionEmailProps,
  type PasswordResetEmailProps,
  type VerificationEmailProps,
  type KycVerificationRequestEmailProps,
  type AccountApprovalEmailProps,
  type AccountSuspendedEmailProps,
  customerQueryReplyEmail,
  type CustomerQueryReplyEmailProps,
} from '@/lib/email/templates';
import type { WtbNotificationQueue, WtbRequest, Company } from '@/types/database';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'BrandNova / B2B LINK <notifications@brandnova.info>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Base email dispatcher function.
 * Dispatches via Resend or logs in development when no API key is configured.
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const effectiveReplyTo = replyTo || 'newcustomers@brandnova.info';

  if (!resend) {
    console.warn(`[EMAIL DISPATCHER (DEV MOCK)] To: ${to} | ReplyTo: ${effectiveReplyTo} | Subject: ${subject}`);
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  try {
    const plainText = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&bull;/g, '•')
      .replace(/&rarr;/g, '->')
      .replace(/\s+/g, ' ')
      .trim();

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text: plainText,
      replyTo: effectiveReplyTo,
    });

    if (error) {
      console.error('[EMAIL DISPATCHER ERROR]', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown email dispatch error';
    console.error('[EMAIL DISPATCHER EXCEPTION]', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Dispatches a New Inquiry alert to the seller.
 */
export async function sendNewInquiryEmail(
  toEmail: string,
  props: Omit<NewInquiryEmailProps, 'actionUrl'> & { inquiryId?: string }
): Promise<SendEmailResult> {
  const actionUrl = `${APP_URL}/dashboard/seller/inquiries${props.inquiryId ? `/${props.inquiryId}` : ''}`;
  const { subject, html } = newInquiryEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches a Niche WTB Alert to a verified seller.
 */
export async function sendNicheWtbAlertEmail(
  toEmail: string,
  props: Omit<NicheWtbAlertEmailProps, 'actionUrl'> & { wtbRequestId: string }
): Promise<SendEmailResult> {
  const actionUrl = `${APP_URL}/dashboard/seller/wtb-board/${props.wtbRequestId}`;
  const { subject, html } = nicheWtbAlertEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches a High-Priority Exact Barcode Match alert.
 */
export async function sendExactBarcodeMatchEmail(
  toEmail: string,
  props: Omit<ExactBarcodeMatchEmailProps, 'actionUrl'> & { wtbRequestId: string }
): Promise<SendEmailResult> {
  const actionUrl = `${APP_URL}/dashboard/seller/wtb-board/${props.wtbRequestId}?match=exact`;
  const { subject, html } = exactBarcodeMatchEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches a Quotation Received alert to the buyer.
 */
export async function sendQuoteReceivedEmail(
  toEmail: string,
  props: Omit<QuoteReceivedEmailProps, 'actionUrl'> & { quotationId?: string; wtbRequestId: string }
): Promise<SendEmailResult> {
  const actionUrl = `${APP_URL}/dashboard/buyer/wtb/${props.wtbRequestId}`;
  const { subject, html } = quoteReceivedEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches a Vetting Decision alert to the seller.
 */
export async function sendVettingDecisionEmail(
  toEmail: string,
  props: Omit<VettingDecisionEmailProps, 'actionUrl'> & { companyId: string }
): Promise<SendEmailResult> {
  const actionUrl = props.decision === 'approved' ? `${APP_URL}/dashboard/seller` : `${APP_URL}/support`;
  const { subject, html } = vettingDecisionEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
  * Dispatches a Password Reset link email.
  */
export async function sendPasswordResetEmail(
  toEmail: string,
  props: PasswordResetEmailProps
): Promise<SendEmailResult> {
  const { subject, html } = passwordResetEmail(props);
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches an account registration email verification OTP code.
 */
export async function sendVerificationEmail(
  toEmail: string,
  props: VerificationEmailProps
): Promise<SendEmailResult> {
  const { subject, html } = verificationEmail(props);
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches KYC Document Checklist Request Email to new wholesale customer
 * Also alerts Jeff / newcustomers@brandnova.info
 */
export async function sendKycVerificationRequestEmail(
  toEmail: string,
  props: Omit<KycVerificationRequestEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const actionUrl = `${APP_URL}/dashboard`;
  const { subject, html } = kycVerificationRequestEmail({ ...props, actionUrl });

  // 1. Send onboarding KYC email to customer (replyTo: newcustomers@brandnova.info)
  const result = await sendEmail({
    to: toEmail,
    subject,
    html,
    replyTo: 'newcustomers@brandnova.info',
  });

  // 2. Alert Jeff / Admin desk at newcustomers@brandnova.info
  try {
    const adminAlert = adminNewCustomerAlertEmail({
      companyName: props.companyName,
      contactName: props.contactName,
      email: toEmail,
      phone: props.phone,
      role: 'wholesale_member',
      actionUrl: `${APP_URL}/site-admin/users`,
    });
    void sendEmail({
      to: 'newcustomers@brandnova.info',
      subject: adminAlert.subject,
      html: adminAlert.html,
      replyTo: toEmail,
    });
  } catch (adminErr) {
    console.warn('[ADMIN KYC ALERT NOTICE]', adminErr);
  }

  return result;
}

/**
 * Dispatches Account Approval Email when Jeff verifies the account
 */
export async function sendAccountApprovalEmail(
  toEmail: string,
  props: Omit<AccountApprovalEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const actionUrl = `${APP_URL}/dashboard`;
  const { subject, html } = accountApprovalEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html, replyTo: 'newcustomers@brandnova.info' });
}

/**
 * Dispatches Account Suspension Email
 */
export async function sendAccountSuspensionEmail(
  toEmail: string,
  props: Omit<AccountSuspendedEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const actionUrl = `${APP_URL}/contact`;
  const { subject, html } = accountSuspendedEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html, replyTo: 'newcustomers@brandnova.info' });
}

type QueueItemWithRelations = WtbNotificationQueue & {
  wtb_request: WtbRequest | null;
  seller_company: Company | null;
};

/**
 * Worker function: processes pending rows in `wtb_notifications_queue`.
 * Fetches seller and WTB request details, dispatches appropriate emails,
 * and updates queue status to 'sent' or 'failed'.
 */
export async function processWtbNotificationQueue(limit = 25): Promise<{
  success: boolean;
  totalProcessed: number;
  sentCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}> {
  const adminClient = createAdminClient();

  const { data: queueItems, error: fetchError } = await adminClient
    .from('wtb_notifications_queue')
    .select(`
      *,
      wtb_request:wtb_requests(*),
      seller_company:companies(*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (fetchError) {
    console.error('[PROCESS WTB QUEUE ERROR]', fetchError);
    return {
      success: false,
      totalProcessed: 0,
      sentCount: 0,
      failedCount: 0,
      errors: [{ id: 'fetch', error: fetchError.message }],
    };
  }

  if (!queueItems || queueItems.length === 0) {
    return {
      success: true,
      totalProcessed: 0,
      sentCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const item of queueItems as unknown as QueueItemWithRelations[]) {
    const { id, notification_type, wtb_request, seller_company } = item;

    if (!wtb_request || !seller_company || !seller_company.email) {
      const errorMsg = 'Missing related WTB request, seller company, or seller email';
      await adminClient
        .from('wtb_notifications_queue')
        .update({
          status: 'failed',
          error_message: errorMsg,
        })
        .eq('id', id);

      failedCount++;
      errors.push({ id, error: errorMsg });
      continue;
    }

    let dispatchResult: SendEmailResult;

    if (notification_type === 'barcode_match' && wtb_request.barcode_or_sku) {
      dispatchResult = await sendExactBarcodeMatchEmail(seller_company.email, {
        sellerName: seller_company.contact_name || seller_company.name,
        productName: wtb_request.product_name,
        barcodeOrSku: wtb_request.barcode_or_sku,
        targetQuantity: wtb_request.target_quantity,
        targetPrice: wtb_request.target_price,
        wtbRequestId: wtb_request.id,
      });
    } else {
      dispatchResult = await sendNicheWtbAlertEmail(seller_company.email, {
        sellerName: seller_company.contact_name || seller_company.name,
        productName: wtb_request.product_name,
        categoryName: wtb_request.category_slug,
        targetQuantity: wtb_request.target_quantity,
        targetPrice: wtb_request.target_price,
        wtbRequestId: wtb_request.id,
      });
    }

    if (dispatchResult.success) {
      await adminClient
        .from('wtb_notifications_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', id);

      sentCount++;
    } else {
      const errorMsg = dispatchResult.error || 'Failed to dispatch email';
      await adminClient
        .from('wtb_notifications_queue')
        .update({
          status: 'failed',
          error_message: errorMsg,
        })
        .eq('id', id);

      failedCount++;
      errors.push({ id, error: errorMsg });
    }
  }

  return {
    success: failedCount === 0,
    totalProcessed: queueItems.length,
    sentCount,
    failedCount,
    errors,
  };
}

/**
 * Dispatches an official support desk response directly to a customer's email.
 */
export async function sendCustomerQueryReplyEmail(
  to: string,
  props: CustomerQueryReplyEmailProps
): Promise<SendEmailResult> {
  const { subject, html } = customerQueryReplyEmail(props);
  return sendEmail({
    to,
    subject: props.subject || subject,
    html,
    replyTo: 'admin@b2blink.co.uk',
  });
}


import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server';
import {
  newInquiryEmail,
  nicheWtbAlertEmail,
  exactBarcodeMatchEmail,
  quoteReceivedEmail,
  vettingDecisionEmail,
  passwordResetEmail,
  passwordResetOtpEmail,
  verificationEmail,
  kycVerificationRequestEmail,
  adminNewCustomerAlertEmail,
  accountApprovalEmail,
  accountSuspendedEmail,
  membershipUpgradeEmail,
  type NewInquiryEmailProps,
  type NicheWtbAlertEmailProps,
  type ExactBarcodeMatchEmailProps,
  type QuoteReceivedEmailProps,
  type VettingDecisionEmailProps,
  type PasswordResetEmailProps,
  type PasswordResetOtpEmailProps,
  type VerificationEmailProps,
  type KycVerificationRequestEmailProps,
  type AccountApprovalEmailProps,
  type AccountSuspendedEmailProps,
  type MembershipUpgradeEmailProps,
  customerQueryReplyEmail,
  type CustomerQueryReplyEmailProps,
  newInAppMessageEmail,
  buyerWtsMatchEmail,
  sellerWtbMatchEmail,
  type BuyerWtsMatchEmailProps,
  type SellerWtbMatchEmailProps,
  listingInactivatedEmail,
  type ListingInactivatedEmailProps,
  inactivityReminderEmail,
  type InactivityReminderEmailProps,
  emailChangeNoticeCurrentEmail,
  type EmailChangeNoticeCurrentEmailProps,
  emailChangeActivationNewEmail,
  type EmailChangeActivationNewEmailProps,
  accountDeletedConfirmationEmail,
  type AccountDeletedConfirmationEmailProps,
} from '@/lib/email/templates';
import type { WtbNotificationQueue, WtbRequest, Company } from '@/types/database';
import { getDynamicAppUrl, sanitizeActionUrl } from '@/lib/utils/app-url';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'B2B LINK <notifications@b2blink.eu>';

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
  const effectiveReplyTo = replyTo || 'support@b2blink.eu';

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
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard/inquiries${props.inquiryId ? `?id=${props.inquiryId}` : ''}`;
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
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard/seller/wtb-board/${props.wtbRequestId}`;
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
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard/seller/wtb-board/${props.wtbRequestId}?match=exact`;
  const { subject, html } = exactBarcodeMatchEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches an immediate alert to a buyer when a seller lists stock matching their WTB request.
 */
export async function sendBuyerWtsMatchEmail(
  toEmail: string,
  props: Omit<BuyerWtsMatchEmailProps, 'actionUrl'> & { matchId?: string; wtbId?: string; productId?: string }
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard?matchTab=true${props.matchId ? `&matchId=${props.matchId}` : ''}`;
  const { subject, html } = buyerWtsMatchEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html, replyTo: 'trading@b2blink.eu' });
}

/**
 * Dispatches an immediate alert to a seller when a buyer posts a WTB matching their active WTS listing.
 */
export async function sendSellerWtbMatchEmail(
  toEmail: string,
  props: Omit<SellerWtbMatchEmailProps, 'actionUrl'> & { matchId?: string; wtbId?: string; productId?: string }
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard?matchTab=true${props.matchId ? `&matchId=${props.matchId}` : ''}`;
  const { subject, html } = sellerWtbMatchEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html, replyTo: 'trading@b2blink.eu' });
}

/**
 * Dispatches a Quotation Received alert to the buyer.
 */
export async function sendQuoteReceivedEmail(
  toEmail: string,
  props: Omit<QuoteReceivedEmailProps, 'actionUrl'> & { quotationId?: string; wtbRequestId: string }
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard/buyer/wtb/${props.wtbRequestId}`;
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
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = props.decision === 'approved' ? `${baseUrl}/dashboard/seller` : `${baseUrl}/support`;
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
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = sanitizeActionUrl(props.actionUrl, baseUrl);
  const { subject, html } = passwordResetEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches a Password Reset 6-digit OTP verification email.
 */
export async function sendPasswordResetOtpEmail(
  toEmail: string,
  props: PasswordResetOtpEmailProps
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = sanitizeActionUrl(props.actionUrl || `${baseUrl}/reset-password`, baseUrl);
  const { subject, html } = passwordResetOtpEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}


/**
 * Dispatches an account registration email verification OTP code.
 */
export async function sendVerificationEmail(
  toEmail: string,
  props: VerificationEmailProps
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = sanitizeActionUrl(props.actionUrl, baseUrl);
  const { subject, html } = verificationEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Dispatches Business Verification Request Email to new wholesale customer
 * Also alerts B2B LINK administration / verification queue
 */
export async function sendKycVerificationRequestEmail(
  toEmail: string,
  props: Omit<KycVerificationRequestEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard`;
  const { subject, html } = kycVerificationRequestEmail({ ...props, actionUrl });

  // 1. Send onboarding verification email to customer (replyTo: newcustomers@brandnova.info)
  const result = await sendEmail({
    to: toEmail,
    subject,
    html,
    replyTo: 'newcustomers@brandnova.info',
  });

  // 2. Alert B2B LINK administration / verification queue
  try {
    const adminAlert = adminNewCustomerAlertEmail({
      companyName: props.companyName,
      contactName: props.contactName,
      email: toEmail,
      phone: props.phone,
      country: props.address ? props.address.split(',').pop()?.trim() : 'Global',
      role: 'wholesale_member',
      actionUrl: `${baseUrl}/site-admin/users`,
    });
    void sendEmail({
      to: 'admin@b2blink.eu',
      subject: adminAlert.subject,
      html: adminAlert.html,
      replyTo: toEmail,
    });
  } catch (adminErr) {
    console.warn('[ADMIN VERIFICATION QUEUE ALERT NOTICE]', adminErr);
  }

  return result;
}

export const sendBusinessVerificationRequestEmail = sendKycVerificationRequestEmail;

/**
 * Dispatches Account Verified Email when the Verification Team activates the member account
 */
export async function sendAccountApprovalEmail(
  toEmail: string,
  props: Omit<AccountApprovalEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/login`;
  const { subject, html } = accountApprovalEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html, replyTo: 'verification@b2blink.eu' });
}

export const sendAccountVerifiedEmail = sendAccountApprovalEmail;

/**
 * Dispatches Membership Upgrade Confirmation Email
 */
export async function sendMembershipUpgradeEmail(
  toEmail: string,
  props: Omit<MembershipUpgradeEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/dashboard`;
  const { subject, html } = membershipUpgradeEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html, replyTo: 'billing@b2blink.eu' });
}

/**
 * Dispatches Account Under Review / Suspension Email
 */
export async function sendAccountSuspensionEmail(
  toEmail: string,
  props: Omit<AccountSuspendedEmailProps, 'actionUrl'> & { status?: 'under_review' | 'suspended' }
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/contact`;
  const { subject, html } = accountSuspendedEmail({ ...props, actionUrl });
  return sendEmail({ to: toEmail, subject, html, replyTo: 'verification@b2blink.eu' });
}

export const sendAccountUnderReviewEmail = sendAccountSuspensionEmail;

/**
 * Dispatches an Email Change Notification to the current (original) email address.
 */
export async function sendEmailChangeNoticeCurrentEmail(
  toEmail: string,
  props: Omit<EmailChangeNoticeCurrentEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/contact`;
  const { subject, html } = emailChangeNoticeCurrentEmail({ ...props, actionUrl });
  return sendEmail({
    to: toEmail,
    subject,
    html,
    replyTo: 'support@b2blink.eu',
  });
}

/**
 * Dispatches an Email Activation Notification to the new email address
 * prompting the member to log in and confirm their new credentials.
 */
export async function sendEmailChangeActivationNewEmail(
  toEmail: string,
  props: Omit<EmailChangeActivationNewEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = `${baseUrl}/login?email=${encodeURIComponent(props.newEmail)}&redirect=${encodeURIComponent('/dashboard')}`;
  const { subject, html } = emailChangeActivationNewEmail({ ...props, actionUrl });
  return sendEmail({
    to: toEmail,
    subject,
    html,
    replyTo: 'support@b2blink.eu',
  });
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

export interface SendNewInAppMessageEmailParams {
  toEmail: string;
  recipientName: string;
  senderName: string;
  senderCompany?: string;
  senderRole?: 'buyer' | 'seller' | 'admin' | string;
  messageText?: string;
  messageCount?: number;
  subjectOrProduct?: string;
  conversationId: string;
  isAdmin?: boolean;
}

/**
 * Dispatches an In-App Message email notification when a user receives a new message.
 */
export async function sendNewInAppMessageEmail(
  params: SendNewInAppMessageEmailParams
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const targetPath = params.isAdmin ? '/site-admin/messages' : '/dashboard/inquiries';
  const actionUrl = `${baseUrl}${targetPath}?id=${params.conversationId}`;
  const { subject, html } = newInAppMessageEmail({
    recipientName: params.recipientName,
    senderName: params.senderName,
    senderCompany: params.senderCompany,
    senderRole: params.senderRole,
    messageText: params.messageText,
    messageCount: params.messageCount,
    subjectOrProduct: params.subjectOrProduct,
    actionUrl,
  });
  return sendEmail({
    to: params.toEmail,
    subject,
    html,
    replyTo: 'notifications@b2blink.eu',
  });
}

/**
 * Dispatches a Listing Inactivated notification email to the seller
 * when their listing has reached its 14-day active timer and has been unpublished.
 */
export async function sendListingInactivatedEmail(
  toEmail: string,
  props: Omit<ListingInactivatedEmailProps, 'actionUrl'> & { actionUrl?: string }
): Promise<SendEmailResult> {
  const baseUrl = await getDynamicAppUrl();
  const actionUrl = props.actionUrl || `${baseUrl}/dashboard/listings?tab=unpublished`;
  const { subject, html } = listingInactivatedEmail({ ...props, actionUrl });
  return sendEmail({
    to: toEmail,
    subject,
    html,
    replyTo: 'support@b2blink.eu',
  });
}

export interface ProcessInactivityRemindersOptions {
  daysThreshold?: number; // default: 30 days (1 month)
  force?: boolean;        // if true, ignores cooldown (admin test)
  targetEmail?: string;   // if set, run only for specific user email
}

export interface InactivityReminderDetail {
  email: string;
  companyName: string;
  contactName: string;
  daysInactive: number;
  activeWtbCount: number;
  activeWtsCount: number;
  status: 'sent' | 'skipped_recent_notification' | 'failed' | 'not_inactive';
  messageId?: string;
  error?: string;
}

export interface ProcessInactivityRemindersResult {
  success: boolean;
  timestamp: string;
  thresholdDays: number;
  totalEvaluated: number;
  eligibleInactive: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
  details: InactivityReminderDetail[];
}

/**
 * Dispatches an Inactivity Reminder email to an individual member.
 */
export async function sendInactivityReminderEmail(
  props: InactivityReminderEmailProps
): Promise<SendEmailResult> {
  const { subject, html } = inactivityReminderEmail(props);
  return sendEmail({
    to: props.recipientEmail,
    subject,
    html,
    replyTo: 'support@b2blink.eu',
  });
}

/**
 * Autonomous Inactivity Reminder Scanner & Batch Engine.
 * Scans all registered wholesale members for 30+ days (1 month) of inactivity.
 * For each inactive account that hasn't received a reminder in the last 30 days:
 * 1. Counts their active WTB requests & WTS listings.
 * 2. Dispatches branded HTML inactivity reminder email prompting them to login and update listings.
 * 3. Records an in-app system message from "B2B LINK Trading Support" in the inquiries/messages store.
 * 4. Updates `last_inactivity_reminder_at` timestamp.
 */
export async function processInactivityReminders(
  options: ProcessInactivityRemindersOptions = {}
): Promise<ProcessInactivityRemindersResult> {
  const daysThreshold = options.daysThreshold ?? 30;
  const force = options.force ?? false;
  const targetEmail = options.targetEmail?.toLowerCase().trim();
  const now = Date.now();
  const cooldownMs = 30 * 24 * 60 * 60 * 1000; // 30 days cooldown between reminder emails

  const details: InactivityReminderDetail[] = [];
  let eligibleInactive = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;

  try {
    const admin = createAdminClient();
    const baseUrl = await getDynamicAppUrl();
    const loginActionUrl = `${baseUrl}/login?redirect=${encodeURIComponent('/dashboard')}`;

    // 1. Fetch companies
    let companies: any[] = [];
    try {
      const { data: compData, error: compErr } = await admin
        .from('companies')
        .select('*');
      if (!compErr && Array.isArray(compData)) {
        companies = compData;
      }
    } catch (e) {
      console.warn('[INACTIVITY SCANNER] Could not fetch companies from DB:', e);
    }

    // 2. Fetch auth users (with timeout guard)
    let authUsers: any[] = [];
    try {
      const timeoutPromise = new Promise<{ data: { users: any[] } | null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 2000)
      );
      const listPromise = admin.auth.admin.listUsers({ page: 1, perPage: 100 });
      const raceResult = await Promise.race([listPromise, timeoutPromise]);
      const usersData = (raceResult as any)?.data?.users || [];
      authUsers = usersData;
    } catch (e) {
      console.warn('[INACTIVITY SCANNER] Could not fetch auth users:', e);
    }

    // 3. Fetch active WTB requests
    const wtbCountsByEmail = new Map<string, number>();
    const wtbCountsByCompanyId = new Map<string, number>();
    try {
      const { data: wtbs } = await admin
        .from('wtb_requests')
        .select('id, buyer_email, buyer_company_id, status')
        .eq('status', 'open');
      if (Array.isArray(wtbs)) {
        wtbs.forEach((w: any) => {
          if (w.buyer_email) {
            const em = String(w.buyer_email).toLowerCase().trim();
            wtbCountsByEmail.set(em, (wtbCountsByEmail.get(em) || 0) + 1);
          }
          if (w.buyer_company_id) {
            wtbCountsByCompanyId.set(w.buyer_company_id, (wtbCountsByCompanyId.get(w.buyer_company_id) || 0) + 1);
          }
        });
      }
    } catch {}

    // 4. Fetch active WTS listings (products)
    const wtsCountsByCompanyId = new Map<string, number>();
    try {
      const { data: prods } = await admin
        .from('products')
        .select('id, company_id, status')
        .in('status', ['active', 'Hot'] as any);
      if (Array.isArray(prods)) {
        prods.forEach((p: any) => {
          if (p.company_id) {
            wtsCountsByCompanyId.set(p.company_id, (wtsCountsByCompanyId.get(p.company_id) || 0) + 1);
          }
        });
      }
    } catch {}

    // Combine accounts (map by normalized email)
    interface UnifiedCandidate {
      id: string;
      email: string;
      companyName: string;
      contactName: string;
      role: string;
      approvalStatus: string;
      lastActiveTimestamp: string;
      lastInactivityReminderAt?: string | null;
    }

    const candidates = new Map<string, UnifiedCandidate>();

    for (const c of companies) {
      const email = (c.contact_email || '').toLowerCase().trim();
      if (!email || c.role === 'admin' || email === 'admin@b2blink.eu') continue;
      if (c.approval_status === 'suspended' || c.approval_status === 'rejected') continue;

      const metaUser = authUsers.find(
        (u: any) => u.id === c.user_id || u.email?.toLowerCase().trim() === email
      );
      const lastActive =
        c.last_active_at ||
        metaUser?.last_sign_in_at ||
        c.updated_at ||
        c.created_at ||
        metaUser?.created_at;

      candidates.set(email, {
        id: c.id,
        email,
        companyName: c.company_name || c.name || metaUser?.user_metadata?.company_name || 'Wholesale Member',
        contactName: c.contact_name || metaUser?.user_metadata?.contact_name || 'Commercial Partner',
        role: c.role || 'seller',
        approvalStatus: c.approval_status || 'pending',
        lastActiveTimestamp: lastActive || new Date().toISOString(),
        lastInactivityReminderAt: c.last_inactivity_reminder_at || null,
      });
    }

    // Also include any auth users not present in companies
    for (const u of authUsers) {
      const email = (u.email || '').toLowerCase().trim();
      if (!email || email === 'admin@b2blink.eu' || u.user_metadata?.role === 'admin') continue;
      if (!candidates.has(email)) {
        const meta = u.user_metadata || {};
        const lastActive = meta.last_active_at || u.last_sign_in_at || u.created_at;
        candidates.set(email, {
          id: u.id,
          email,
          companyName: meta.company_name || 'Wholesale Member',
          contactName: meta.contact_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || 'Commercial Partner',
          role: meta.role || 'seller',
          approvalStatus: meta.approval_status || 'pending',
          lastActiveTimestamp: lastActive || new Date().toISOString(),
          lastInactivityReminderAt: meta.last_inactivity_reminder_at || null,
        });
      }
    }

    // Process each candidate
    for (const cand of candidates.values()) {
      if (targetEmail && cand.email !== targetEmail) {
        continue;
      }

      const lastActiveDate = new Date(cand.lastActiveTimestamp);
      const inactiveMs = now - lastActiveDate.getTime();
      const daysInactive = Math.max(0, Math.floor(inactiveMs / (1000 * 60 * 60 * 24)));

      const activeWtb = (wtbCountsByEmail.get(cand.email) || 0) + (wtbCountsByCompanyId.get(cand.id) || 0);
      const activeWts = wtsCountsByCompanyId.get(cand.id) || 0;

      // Check if candidate meets the inactivity threshold
      if (daysInactive < daysThreshold && !force) {
        details.push({
          email: cand.email,
          companyName: cand.companyName,
          contactName: cand.contactName,
          daysInactive,
          activeWtbCount: activeWtb,
          activeWtsCount: activeWts,
          status: 'not_inactive',
        });
        continue;
      }

      eligibleInactive++;

      // Check cooldown: do not send if reminder was already sent within cooldown period
      if (!force && cand.lastInactivityReminderAt) {
        const lastReminderMs = new Date(cand.lastInactivityReminderAt).getTime();
        const msSinceReminder = now - lastReminderMs;
        // If sent after their last activity AND within cooldown period:
        if (lastReminderMs >= lastActiveDate.getTime() && msSinceReminder < cooldownMs) {
          emailsSkipped++;
          details.push({
            email: cand.email,
            companyName: cand.companyName,
            contactName: cand.contactName,
            daysInactive,
            activeWtbCount: activeWtb,
            activeWtsCount: activeWts,
            status: 'skipped_recent_notification',
          });
          continue;
        }
      }

      // Dispatch reminder email
      const sendRes = await sendInactivityReminderEmail({
        recipientEmail: cand.email,
        contactName: cand.contactName,
        companyName: cand.companyName,
        daysInactive,
        activeWtbCount: activeWtb,
        activeWtsCount: activeWts,
        actionUrl: loginActionUrl,
      });

      if (sendRes.success) {
        emailsSent++;
        const nowIso = new Date().toISOString();

        // 1. Update company record in DB
        try {
          await admin
            .from('companies')
            .update({
              last_inactivity_reminder_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', cand.id);
        } catch {}

        // 2. Post autonomous in-app message from "B2B LINK Trading Support"
        try {
          const reminderMsgText = `Hello ${cand.contactName},\n\nIt has been over a month since your last activity on B2B LINK.\n\nWholesale market pricing, buyer demand, and stock availability move rapidly. To ensure you continue receiving accurate Buyer-Seller Matches and relevant quotations, please take a moment to review and update your active Want-To-Buy (WTB) sourcing demands and Want-To-Sell (WTS) inventory listings.\n\nKind regards,\nB2B LINK Trading Support`;

          const convId = `inactivity-reminder-${cand.id}`;
          const newChatMsg = {
            id: `msg-inactivity-${Date.now()}`,
            senderId: 'facbb93f-080f-480f-b54b-8ef26664da86',
            senderName: 'B2B LINK Trading Support',
            senderRole: 'admin',
            text: reminderMsgText,
            timestamp: nowIso,
            isRead: false,
          };

          await admin.from('product_inquiries').insert({
            id: convId,
            product_id: '00000000-0000-0000-0000-000000000000',
            seller_company_id: cand.id,
            buyer_email: cand.email,
            buyer_name: cand.contactName,
            buyer_company: cand.companyName,
            message: JSON.stringify([newChatMsg]),
            status: 'admin_desk',
            created_at: nowIso,
          });
        } catch {}

        details.push({
          email: cand.email,
          companyName: cand.companyName,
          contactName: cand.contactName,
          daysInactive,
          activeWtbCount: activeWtb,
          activeWtsCount: activeWts,
          status: 'sent',
          messageId: sendRes.messageId,
        });
      } else {
        emailsFailed++;
        details.push({
          email: cand.email,
          companyName: cand.companyName,
          contactName: cand.contactName,
          daysInactive,
          activeWtbCount: activeWtb,
          activeWtsCount: activeWts,
          status: 'failed',
          error: sendRes.error,
        });
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      thresholdDays: daysThreshold,
      totalEvaluated: candidates.size,
      eligibleInactive,
      emailsSent,
      emailsSkipped,
      emailsFailed,
      details,
    };
  } catch (err) {
    console.error('[INACTIVITY PROCESSOR FATAL ERROR]', err);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      thresholdDays: daysThreshold,
      totalEvaluated: 0,
      eligibleInactive,
      emailsSent,
      emailsSkipped,
      emailsFailed,
      details,
    };
  }
}

/**
 * Dispatches an account deletion confirmation email to the user's registered email address.
 */
export async function sendAccountDeletionConfirmationEmail(
  toEmail: string,
  props: Omit<AccountDeletedConfirmationEmailProps, 'actionUrl'>
): Promise<SendEmailResult> {
  const dynamicAppUrl = await getDynamicAppUrl();
  const actionUrl = sanitizeActionUrl(dynamicAppUrl, '/');

  const { subject, html } = accountDeletedConfirmationEmail({
    ...props,
    actionUrl,
  });

  return sendEmail({
    to: toEmail,
    subject,
    html,
  });
}






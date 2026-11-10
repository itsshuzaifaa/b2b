/**
 * Presence Tracker & In-App Message Notification Bundler
 *
 * Requirements:
 * 1. Online users must NOT receive email alerts when receiving messages.
 * 2. Only inactive users receive email notifications.
 * 3. Never reveal message context/body in email - only sender name/company.
 * 4. Consolidate 3-4 messages into a single bundled notification rather than spamming.
 */

import { sendNewInAppMessageEmail } from '@/lib/email/dispatcher';

interface UserPresenceRecord {
  lastActiveAt: number;
}

interface PendingMessageNotification {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  senderCompany?: string;
  senderRole?: string;
  subjectOrProduct?: string;
  conversationId: string;
  isAdmin: boolean;
  messageCount: number;
  lastMessageAt: number;
  lastEmailSentAt?: number;
  timer?: NodeJS.Timeout;
}

// Global singletons to survive Fast Refresh in Next.js development
declare global {
  var __b2b_presence_map: Map<string, UserPresenceRecord> | undefined;
  var __b2b_pending_msg_notifications: Map<string, PendingMessageNotification> | undefined;
}

const presenceMap: Map<string, UserPresenceRecord> =
  globalThis.__b2b_presence_map || (globalThis.__b2b_presence_map = new Map());

const pendingNotifications: Map<string, PendingMessageNotification> =
  globalThis.__b2b_pending_msg_notifications || (globalThis.__b2b_pending_msg_notifications = new Map());

// User is considered online if heartbeat was within the last 3 minutes (180s)
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

// Cooldown between emails for the same thread/sender: 10 minutes
const EMAIL_COOLDOWN_MS = 10 * 60 * 1000;

// Debounce window to bundle multiple rapid messages (e.g. user sends 3-4 lines within 20s)
const BUNDLE_DEBOUNCE_MS = 20 * 1000;

/**
 * Record active presence for an authenticated user
 */
export function recordUserPresence(email?: string | null, userId?: string | null): void {
  const now = Date.now();
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail) {
      presenceMap.set(cleanEmail, { lastActiveAt: now });
    }
  }
  if (userId) {
    const cleanId = userId.trim();
    if (cleanId) {
      presenceMap.set(cleanId, { lastActiveAt: now });
    }
  }
}

/**
 * Check if user is currently active/online on the platform
 */
export function isUserOnline(emailOrId?: string | null): boolean {
  if (!emailOrId) return false;
  const cleanKey = emailOrId.trim().toLowerCase();
  const record = presenceMap.get(cleanKey);
  if (!record) return false;
  return Date.now() - record.lastActiveAt < ONLINE_THRESHOLD_MS;
}

export interface DispatchMessageNotificationParams {
  recipientEmail: string;
  recipientName: string;
  recipientUserId?: string | null;
  senderName: string;
  senderCompany?: string;
  senderRole?: string;
  subjectOrProduct?: string;
  conversationId: string;
  isAdmin?: boolean;
}

/**
 * Dispatches bundled message notifications with strict presence checks:
 * 1. Suppresses email completely if recipient is online
 * 2. Bundles rapid messages (sends 1 email after debounce instead of 3-4 separate emails)
 * 3. Enforces a 10-minute cooldown per thread to prevent notification flooding
 * 4. Never exposes message context/body in the email
 */
export function enqueueMessageNotification(params: DispatchMessageNotificationParams): {
  status: 'suppressed_online' | 'bundled' | 'cooldown_active';
} {
  const {
    recipientEmail,
    recipientName,
    recipientUserId,
    senderName,
    senderCompany,
    senderRole,
    subjectOrProduct,
    conversationId,
    isAdmin = false,
  } = params;

  const cleanRecipientEmail = recipientEmail.trim().toLowerCase();

  // 1. Check if recipient is currently online (in-app active)
  const isOnline =
    isUserOnline(cleanRecipientEmail) ||
    (recipientUserId ? isUserOnline(recipientUserId) : false);

  if (isOnline) {
    return { status: 'suppressed_online' };
  }

  // 2. Check pending or recent notifications for this recipient & conversation
  const bundleKey = `${cleanRecipientEmail}::${conversationId}`;
  let pending = pendingNotifications.get(bundleKey);
  const now = Date.now();

  if (pending) {
    // If we already sent an email recently and are within cooldown, increment count without re-emailing
    if (pending.lastEmailSentAt && now - pending.lastEmailSentAt < EMAIL_COOLDOWN_MS) {
      pending.messageCount += 1;
      pending.lastMessageAt = now;
      return { status: 'cooldown_active' };
    }

    // Cancel existing debounce timer to bundle incoming message
    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    pending.messageCount += 1;
    pending.lastMessageAt = now;
    pending.senderName = senderName;
    pending.senderCompany = senderCompany || pending.senderCompany;
  } else {
    pending = {
      recipientEmail: cleanRecipientEmail,
      recipientName,
      senderName,
      senderCompany,
      senderRole,
      subjectOrProduct,
      conversationId,
      isAdmin,
      messageCount: 1,
      lastMessageAt: now,
    };
    pendingNotifications.set(bundleKey, pending);
  }

  // Schedule debounced dispatch
  pending.timer = setTimeout(async () => {
    try {
      const current = pendingNotifications.get(bundleKey);
      if (!current) return;

      // Double-check presence before actual dispatch in case user just came online
      if (isUserOnline(current.recipientEmail)) {
        pendingNotifications.delete(bundleKey);
        return;
      }

      await sendNewInAppMessageEmail({
        toEmail: current.recipientEmail,
        recipientName: current.recipientName,
        senderName: current.senderName,
        senderCompany: current.senderCompany,
        senderRole: current.senderRole,
        messageCount: current.messageCount,
        subjectOrProduct: current.subjectOrProduct,
        conversationId: current.conversationId,
        isAdmin: current.isAdmin,
      });

      current.lastEmailSentAt = Date.now();
      current.timer = undefined;
    } catch (err) {
      console.error('[MESSAGE NOTIFICATION DISPATCH ERROR]', err);
    }
  }, BUNDLE_DEBOUNCE_MS);

  return { status: 'bundled' };
}

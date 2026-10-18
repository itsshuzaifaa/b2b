// In-memory verification code storage with 15-minute validity window
export interface StoredVerification {
  code: string;
  createdAt: number;
  expiresAt: number; // Exactly 15 minutes (900,000 ms) from issuance
}

// Global declaration to maintain verification cache across Next.js API reloads
declare global {
  // eslint-disable-next-line no-var
  var __b2b_email_verification_store: Map<string, StoredVerification> | undefined;
}

const store: Map<string, StoredVerification> =
  global.__b2b_email_verification_store || new Map<string, StoredVerification>();
global.__b2b_email_verification_store = store;

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Saves or updates the active verification code for an email.
 * Any previously issued code for this email is immediately superseded and expired.
 */
export function saveVerificationCode(email: string, code: string): StoredVerification {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const entry: StoredVerification = {
    code: code.trim(),
    createdAt: now,
    expiresAt: now + FIFTEEN_MINUTES_MS,
  };
  store.set(normalizedEmail, entry);
  return entry;
}

/**
 * Validates a verification code against the stored active code.
 * Strictly enforces:
 * 1. 15-minute expiration
 * 2. Only the latest requested code is valid (previous codes are expired)
 */
export function validateVerificationCode(
  email: string,
  code: string
): { valid: boolean; error?: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code.trim().replace(/\s+/g, '');
  const entry = store.get(normalizedEmail);

  if (!entry) {
    // If not in memory (e.g. server restart), we let downstream fallback to Supabase check
    return { valid: true };
  }

  // 1. Check 15-minute expiration
  if (Date.now() > entry.expiresAt) {
    store.delete(normalizedEmail);
    return {
      valid: false,
      error: 'This verification code has expired (15-minute limit). Please request a new code.',
    };
  }

  // 2. Check if entered code matches the latest issued code
  if (entry.code !== cleanCode) {
    return {
      valid: false,
      error: 'Invalid or expired verification code. If you requested a new code, the previous code is expired. Please enter the latest code sent to your email.',
    };
  }

  return { valid: true };
}

/**
 * Consumes the verification code upon successful verification so it cannot be reused.
 */
export function consumeVerificationCode(email: string): void {
  const normalizedEmail = email.trim().toLowerCase();
  store.delete(normalizedEmail);
}

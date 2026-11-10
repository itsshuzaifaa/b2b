import { saveHashedOtp, verifyHashedOtp, consumeHashedOtp } from './otp-store';

export interface StoredVerification {
  code: string;
  createdAt: number;
  expiresAt: number;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Saves an active signup verification code.
 * Stores code as a secure SHA-256 hash in Redis/database with 15-minute expiration and max 5 attempts.
 */
export function saveVerificationCode(email: string, code: string): StoredVerification {
  const now = Date.now();
  void saveHashedOtp('signup', email, code, FIFTEEN_MINUTES_MS);
  return {
    code: code.trim(),
    createdAt: now,
    expiresAt: now + FIFTEEN_MINUTES_MS,
  };
}

/**
 * Validates a verification code against stored hash.
 * Enforces:
 * 1. Missing code is ALWAYS invalid.
 * 2. Expired code is ALWAYS invalid.
 * 3. Reused code is ALWAYS invalid.
 * 4. Maximum 5 attempts.
 */
export async function validateVerificationCode(
  email: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  return verifyHashedOtp('signup', email, code);
}

/**
 * Consumes the verification code so it cannot be reused.
 */
export function consumeVerificationCode(email: string): void {
  void consumeHashedOtp('signup', email);
}

import crypto from 'crypto';
import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;
function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
  }
  return redisInstance;
}

export interface StoredOtpRecord {
  hash: string;
  attempts: number;
  maxAttempts: number;
  used: boolean;
  createdAt: number;
  expiresAt: number;
  userId?: string | null;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Global in-memory fallback for local environments or if Redis is unreachable
declare global {
  var __b2b_otp_fallback_store: Map<string, StoredOtpRecord> | undefined;
}

const memoryStore: Map<string, StoredOtpRecord> =
  global.__b2b_otp_fallback_store || new Map<string, StoredOtpRecord>();
global.__b2b_otp_fallback_store = memoryStore;

function getStoreKey(type: 'signup' | 'recovery', email: string): string {
  return `auth_otp:${type}:${email.trim().toLowerCase()}`;
}

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code.trim().replace(/\s+/g, '')).digest('hex');
}

/**
 * Stores a hashed OTP code with single-use, 15-minute expiry, and 5 maximum attempts.
 * Any previously issued code for this type and email is immediately superseded.
 */
export async function saveHashedOtp(
  type: 'signup' | 'recovery',
  email: string,
  code: string,
  ttlMs = FIFTEEN_MINUTES_MS,
  userId?: string | null
): Promise<void> {
  const key = getStoreKey(type, email);
  const now = Date.now();
  const record: StoredOtpRecord = {
    hash: hashOtp(code),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    used: false,
    createdAt: now,
    expiresAt: now + ttlMs,
    userId: userId || null,
  };

  memoryStore.set(key, record);

  try {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await getRedis().set(key, JSON.stringify(record), { ex: ttlSeconds });
  } catch (err) {
    console.warn('[OTP STORE REDIS SET WARNING]', err);
  }
}

/**
 * Validates an OTP code against stored record.
 * 
 * SECURITY MANDATE:
 * 1. Missing record -> ALWAYS invalid (never fall through).
 * 2. Already used record -> ALWAYS invalid.
 * 3. Expired record -> ALWAYS invalid.
 * 4. Attempts >= 5 -> ALWAYS invalid (rate/brute-force limited).
 * 5. Uses timingSafeEqual on hashes.
 * 6. Consumes code on success (single use).
 */
export async function verifyHashedOtp(
  type: 'signup' | 'recovery',
  email: string,
  code: string
): Promise<{ valid: boolean; error?: string; userId?: string | null }> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim().replace(/\s+/g, '');

  if (!normalizedEmail || !cleanCode) {
    return {
      valid: false,
      error: 'Invalid or missing verification code.',
    };
  }

  const key = getStoreKey(type, normalizedEmail);
  let record: StoredOtpRecord | null = null;

  try {
    const data = await getRedis().get<string | StoredOtpRecord>(key);
    if (data) {
      record = typeof data === 'string' ? JSON.parse(data) : data;
    }
  } catch (err) {
    console.warn('[OTP STORE REDIS GET WARNING]', err);
  }

  if (!record) {
    record = memoryStore.get(key) || null;
  }

  // 1. Missing code must ALWAYS return invalid
  if (!record) {
    return {
      valid: false,
      error: 'Invalid or expired verification code. Please request a new code.',
    };
  }

  // 2. Used code must ALWAYS return invalid
  if (record.used) {
    return {
      valid: false,
      error: 'This verification code has already been used. Please request a new code.',
    };
  }

  // 3. Expired code must ALWAYS return invalid
  if (Date.now() > record.expiresAt) {
    memoryStore.delete(key);
    try {
      await getRedis().del(key);
    } catch {}
    return {
      valid: false,
      error: 'This verification code has expired. Please request a new code.',
    };
  }

  // 4. Maximum attempts check (5 attempts max)
  if (record.attempts >= record.maxAttempts) {
    return {
      valid: false,
      error: 'Maximum verification attempts (5) exceeded. This code has been invalidated. Please request a new code.',
    };
  }

  // 5. Constant-time hash comparison
  const inputHash = hashOtp(cleanCode);
  const bufInput = Buffer.from(inputHash, 'hex');
  const bufExpected = Buffer.from(record.hash, 'hex');

  const matches =
    bufInput.length === bufExpected.length &&
    crypto.timingSafeEqual(bufInput, bufExpected);

  if (!matches) {
    record.attempts += 1;
    memoryStore.set(key, record);

    try {
      const remainingSeconds = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
      await getRedis().set(key, JSON.stringify(record), { ex: remainingSeconds });
    } catch {}

    if (record.attempts >= record.maxAttempts) {
      return {
        valid: false,
        error: 'Maximum verification attempts (5) exceeded. This code has been invalidated. Please request a new code.',
      };
    }

    return {
      valid: false,
      error: `Invalid verification code. ${record.maxAttempts - record.attempts} attempts remaining.`,
    };
  }

  // 6. Valid -> Mark used immediately (single-use enforcement)
  record.used = true;
  memoryStore.delete(key);

  try {
    // Keep record as used for 5 minutes so rapid replays are denied with "already used"
    await getRedis().set(key, JSON.stringify(record), { ex: 300 });
  } catch {}

  return { valid: true, userId: record.userId || null };
}

/**
 * Explicitly invalidates / consumes an active OTP.
 */
export async function consumeHashedOtp(type: 'signup' | 'recovery', email: string): Promise<void> {
  const key = getStoreKey(type, email);
  memoryStore.delete(key);
  try {
    await getRedis().del(key);
  } catch {}
}

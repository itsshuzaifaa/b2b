import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Extracts client IP from standard reverse-proxy headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Dedicated Upstash sliding-window rate limiters per route.
 */
const limiters = {
  register: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 m'),
    prefix: 'rl:register',
  }),
  'send-verification': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 m'),
    prefix: 'rl:send_verification',
  }),
  'forgot-password': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'rl:forgot_password',
  }),
  'reset-password': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    prefix: 'rl:reset_password',
  }),
  'verify-code': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 m'),
    prefix: 'rl:verify_code',
  }),
  'check-username': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'rl:check_username',
  }),
  'lookup-username': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '1 m'),
    prefix: 'rl:lookup_username',
  }),
  contact: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 m'),
    prefix: 'rl:contact',
  }),
  'notify-inactivated': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 m'),
    prefix: 'rl:notify_inactivated',
  }),
};

export type RateLimitedRoute = keyof typeof limiters;

const AUTH_AND_OTP_ROUTES: Set<RateLimitedRoute> = new Set([
  'register',
  'send-verification',
  'forgot-password',
  'reset-password',
  'verify-code',
  'lookup-username',
  'check-username',
]);

/**
 * Enforces rate limiting on a route.
 * Returns HTTP 429 with 'Retry-After' header if threshold is exceeded.
 * Returns null if allowed.
 * 
 * SECURITY MANDATE:
 * Auth and OTP routes FAIL CLOSED (HTTP 503) if rate limiter backend is unreachable,
 * preventing brute-force bypasses during upstream Redis outages.
 */
export async function enforceRateLimit(
  req: NextRequest,
  route: RateLimitedRoute,
  extraKey?: string
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const identifier = extraKey
    ? `${ip}:${extraKey.trim().toLowerCase()}`
    : ip;

  const limiter = limiters[route];
  if (!limiter) return null;

  try {
    const { success, reset } = await limiter.limit(identifier);
    if (!success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        {
          error: 'Too many requests. Please slow down and try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }
  } catch (err) {
    console.warn(`[RATE LIMIT UPSTASH WARNING (${route})]`, err);
    // Fail closed on all auth and OTP routes
    if (AUTH_AND_OTP_ROUTES.has(route)) {
      return NextResponse.json(
        {
          error: 'Authentication and security services are temporarily unavailable. Please try again shortly.',
          code: 'SECURITY_RATE_LIMITER_UNAVAILABLE',
        },
        { status: 503 }
      );
    }
  }

  return null;
}

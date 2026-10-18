import { NextRequest } from 'next/server';

/**
 * Dynamically resolves the base application URL (e.g. https://b2blink.eu, https://your-app.vercel.app, or http://localhost:3000)
 * Automatically detects:
 * 1. Incoming HTTP request headers (x-forwarded-host, host)
 * 2. Next.js server context headers()
 * 3. Vercel deployment environment variables (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL)
 * 4. Custom NEXT_PUBLIC_APP_URL
 * 5. Production domain fallback (https://b2blink.eu)
 */
export async function getDynamicAppUrl(req?: Request | NextRequest | null): Promise<string> {
  // 1. Try from passed request object
  if (req) {
    const fromReq = getOriginFromHeaders(req.headers, req.url);
    if (fromReq) return fromReq;
  }

  // 2. Try from Next.js dynamic headers() if in a server execution context
  try {
    const { headers } = await import('next/headers');
    const headerList = await headers();
    const fromHeaders = getOriginFromHeaders(headerList);
    if (fromHeaders) return fromHeaders;
  } catch {
    // Outside request context (e.g. background queue worker or static pre-render)
  }

  // 3. Try Vercel environment variables
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/\/+$/, '')}`;
  }

  // 4. Try NEXT_PUBLIC_APP_URL (ignore localhost if in production or on Vercel)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  if (envUrl && (!isProd || !envUrl.includes('localhost'))) {
    return envUrl.replace(/\/+$/, '');
  }

  // 5. Production fallback to verified domain
  if (isProd) {
    return 'https://b2blink.eu';
  }

  return 'http://localhost:3000';
}

function getOriginFromHeaders(
  headers: Headers | { get(name: string): string | null },
  fallbackUrl?: string
): string | null {
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) {
    if (fallbackUrl) {
      try {
        const u = new URL(fallbackUrl);
        if (u.origin && !u.origin.includes('0.0.0.0')) return u.origin.replace(/\/+$/, '');
      } catch {
        // ignore
      }
    }
    return null;
  }

  const cleanHost = host.split(',')[0].trim();
  let proto = headers.get('x-forwarded-proto')?.split(',')[0].trim();
  if (!proto) {
    proto = cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1') ? 'http' : 'https';
  }

  return `${proto}://${cleanHost}`.replace(/\/+$/, '');
}

/**
 * Sanitizes an action URL (such as Supabase magiclink / verification URLs),
 * dynamically replacing any hardcoded 'localhost:3000' or 'localhost:3001' with the active connected domain.
 */
export function sanitizeActionUrl(rawUrl: string, dynamicBaseUrl: string): string {
  if (!rawUrl) return dynamicBaseUrl;

  const cleanBase = dynamicBaseUrl.replace(/\/+$/, '');

  // 1. If rawUrl itself starts with localhost or 127.0.0.1, swap origin directly
  if (
    rawUrl.startsWith('http://localhost:3000') ||
    rawUrl.startsWith('http://localhost:3001') ||
    rawUrl.startsWith('http://127.0.0.1:3000') ||
    rawUrl.startsWith('http://127.0.0.1:3001')
  ) {
    return rawUrl.replace(/^http:\/\/(localhost|127\.0\.0\.1):(3000|3001)/, cleanBase);
  }

  // 2. If it's a Supabase verify link or similar with a redirect_to parameter pointing to localhost:
  let sanitized = rawUrl;

  // Replace unencoded localhost references
  sanitized = sanitized.replace(/http:\/\/(localhost|127\.0\.0\.1):(3000|3001)/g, cleanBase);

  // Replace URL-encoded localhost references (e.g. redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback)
  const encodedCleanBase = encodeURIComponent(cleanBase);
  sanitized = sanitized.replace(
    /http(%3A%2F%2F|%3a%2f%2f)(localhost|127\.0\.0\.1)(%3A|%3a)(3000|3001)/gi,
    encodedCleanBase
  );

  return sanitized;
}

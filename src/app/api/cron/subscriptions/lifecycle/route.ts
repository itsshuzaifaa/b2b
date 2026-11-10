import { NextRequest, NextResponse } from 'next/server';
import { verifyCronOrAdmin } from '@/lib/auth/guards';
import { executeSubscriptionLifecycleSweep } from '@/lib/billing/subscription-service';

/**
 * Automated Cron & Administrative Maintenance Endpoint
 * GET / POST /api/cron/subscriptions/lifecycle
 * 
 * SECURITY MANDATE:
 * 1. Protected by verifyCronOrAdmin(request).
 *    Requires constant-time verified Bearer token matching CRON_SECRET, or admin session.
 * 2. Unauthenticated requests are rejected with HTTP 401.
 * 
 * FUNCTIONS:
 * - Sweeps period-end cancellations past their expiration timestamp and demotes to Bronze.
 * - Sweeps past-due subscriptions on Day 1, Day 3, and Day 5 retries.
 * - Demotes past-due subscriptions to Bronze after Day 5 final failure (zero extra grace).
 * - Executes automated sandbox renewals.
 */
async function handleLifecycleSweep(req: NextRequest) {
  const isAuthorized = await verifyCronOrAdmin(req);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid CRON_SECRET Bearer token or administrator privileges required.' },
      { status: 401 }
    );
  }

  try {
    const results = await executeSubscriptionLifecycleSweep();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (err) {
    console.error('[CRON SUBSCRIPTION LIFECYCLE ERROR]', err);
    return NextResponse.json(
      { error: 'Internal server error processing subscription sweep.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleLifecycleSweep(req);
}

export async function POST(req: NextRequest) {
  return handleLifecycleSweep(req);
}

import { NextRequest, NextResponse } from 'next/server';
import { processInactivityReminders } from '@/lib/email/dispatcher';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Autonomous Cron Route: /api/cron/inactivity-reminders
 * 
 * Triggered automatically by Vercel Cron, external schedulers, or platform administrators.
 * Scans all registered wholesale accounts for 30+ days (1 month) of inactivity and dispatches
 * reminder emails prompting members to log in and refresh their WTB & WTS requests.
 */
export async function GET(request: NextRequest) {
  return handleInactivityCheck(request);
}

export async function POST(request: NextRequest) {
  return handleInactivityCheck(request);
}

async function handleInactivityCheck(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get('secret');

    // 1. Verify Authorization
    let isAuthorized = false;

    // Check bearer or query secret if configured
    if (cronSecret) {
      if (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret) {
        isAuthorized = true;
      }
    } else {
      // In dev environment or without CRON_SECRET configured
      isAuthorized = true;
    }

    // Check admin session if not already authorized by secret
    if (!isAuthorized) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && (user.user_metadata?.role === 'admin' || user.email === 'admin@b2blink.eu')) {
          isAuthorized = true;
        }
      } catch {
        // session check failed
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret or admin credentials.' },
        { status: 401 }
      );
    }

    // 2. Parse Execution Parameters
    let daysThreshold = 30;
    const daysParam = searchParams.get('days');
    if (daysParam) {
      const parsed = parseInt(daysParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        daysThreshold = parsed;
      }
    }

    let force = searchParams.get('force') === 'true';
    let targetEmail = searchParams.get('email') || undefined;

    // Also check JSON body if POST
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.days) daysThreshold = Number(body.days);
        if (body.force !== undefined) force = Boolean(body.force);
        if (body.email) targetEmail = String(body.email);
      } catch {
        // empty body ok
      }
    }

    // 3. Process Inactivity Reminders
    const result = await processInactivityReminders({
      daysThreshold,
      force,
      targetEmail,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API CRON INACTIVITY REMINDERS ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error while processing inactivity reminders',
      },
      { status: 500 }
    );
  }
}

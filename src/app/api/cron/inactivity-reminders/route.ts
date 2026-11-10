import { NextRequest, NextResponse } from 'next/server';
import { processInactivityReminders } from '@/lib/email/dispatcher';
import { verifyCronOrAdmin } from '@/lib/auth/guards';



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
    const isAuthorized = await verifyCronOrAdmin(request);

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret or admin credentials.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

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

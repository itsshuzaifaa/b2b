import { NextResponse } from 'next/server';

/**
 * POST /api/billing/activate-tier
 * DISABLED: Direct tier activation is permanently disabled.
 * Tier changes and membership upgrades require a verified, signed payment gateway webhook.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Forbidden: Direct tier activation is disabled. Membership upgrades require a verified payment webhook.',
      code: 'FEATURE_DISABLED',
    },
    { status: 403 }
  );
}

'use client';

import { TIER_LIMITS, type MembershipTier } from '@/types/database';

const UNLOCK_STORAGE_PREFIX = 'b2b_unlocked_leads_';
const UNLOCK_EVENT_NAME = 'b2b_lead_unlock_update';

function getStorageKey(companyId: string): string {
  return `${UNLOCK_STORAGE_PREFIX}${companyId || 'guest'}`;
}

export function broadcastUnlockUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNLOCK_EVENT_NAME));
  }
}

/**
 * Returns all item IDs (product IDs or WTB request IDs) unlocked by this company
 */
export function getUnlockedLeadIds(companyId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Checks if a specific product or WTB contact has already been unlocked by this company
 */
export function isLeadUnlocked(companyId: string, leadId: string): boolean {
  if (!leadId) return false;
  const unlocked = getUnlockedLeadIds(companyId);
  return unlocked.includes(leadId);
}

/**
 * Calculates remaining unlocks based on membership tier
 */
export function getRemainingUnlocks(companyId: string, tier: MembershipTier = 'bronze'): number {
  const limit = TIER_LIMITS[tier]?.contactUnlocks ?? 2;
  if (limit === Infinity) return Infinity;

  const used = getUnlockedLeadIds(companyId).length;
  return Math.max(0, limit - used);
}

/**
 * Checks whether user has exhausted their contact unlocks
 */
export function hasExhaustedUnlocks(companyId: string, tier: MembershipTier = 'bronze'): boolean {
  const remaining = getRemainingUnlocks(companyId, tier);
  return remaining <= 0;
}

/**
 * Unlocks a lead contact.
 * - If already unlocked, returns success.
 * - If not unlocked, verifies quota, appends to storage, and broadcasts change.
 */
export function unlockLead(
  companyId: string,
  leadId: string,
  tier: MembershipTier = 'bronze'
): { success: boolean; remaining: number; error?: string } {
  if (typeof window === 'undefined') {
    return { success: false, remaining: 0, error: 'Cannot unlock on server' };
  }

  const unlocked = getUnlockedLeadIds(companyId);
  if (unlocked.includes(leadId)) {
    return { success: true, remaining: getRemainingUnlocks(companyId, tier) };
  }

  const limit = TIER_LIMITS[tier]?.contactUnlocks ?? 2;
  if (limit !== Infinity && unlocked.length >= limit) {
    return {
      success: false,
      remaining: 0,
      error: `You have reached your limit of ${limit} contact unlocks on the ${tier.toUpperCase()} plan. Please upgrade to unlock more.`,
    };
  }

  const updated = [...unlocked, leadId];
  try {
    localStorage.setItem(getStorageKey(companyId), JSON.stringify(updated));
    broadcastUnlockUpdate();
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - updated.length);
    return { success: true, remaining };
  } catch {
    return { success: false, remaining: 0, error: 'Failed to save unlock status' };
  }
}

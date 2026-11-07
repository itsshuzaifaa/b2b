export type MatchType = 'exact_barcode' | 'title_keyword';
export type MatchTriggerDirection = 'wts_created' | 'wtb_created';

export interface TradeMatch {
  id: string;
  matchType: MatchType;
  triggerDirection: MatchTriggerDirection;
  confidence: number; // 100 for exact barcode, 80-95 for title/model keyword
  createdAt: string;

  // WTB info (Buyer)
  wtbId: string;
  wtbProductName: string;
  wtbBarcode?: string | null;
  wtbTargetPrice: number;
  wtbTargetQuantity: number;
  buyerCompanyId?: string | null;
  buyerCompanyName: string;
  buyerEmail: string;
  buyerPhone?: string | null;

  // WTS info (Seller)
  wtsProductId: string;
  wtsTitle: string;
  wtsBarcode?: string | null;
  wtsUnitPrice: number;
  wtsQuantityAvailable: number;
  wtsCondition?: string | null;
  wtsLocation?: string | null;
  sellerCompanyId: string;
  sellerCompanyName: string;
  sellerEmail?: string | null;
  sellerPhone?: string | null;

  // Status
  readByBuyer?: boolean;
  readBySeller?: boolean;
  dismissedByBuyer?: boolean;
  dismissedBySeller?: boolean;
}

export const STORAGE_KEY = 'b2b_trade_matches_v1';
export const EVENT_KEY = 'b2b_trade_matches_updated';

// Common stop words to exclude when tokenizing titles
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'to', 'of',
  'is', 'lot', 'wholesale', 'stock', 'units', 'pcs', 'box', 'brand', 'original', 'sealed',
  'new', 'used', 'refurbished', 'condition', 'standard', 'delivery', 'verified'
]);

/**
 * Normalizes barcode / SKU by stripping non-alphanumeric characters, trimming, and uppercasing.
 */
export function normalizeBarcode(barcode?: string | null): string {
  if (!barcode) return '';
  const clean = barcode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean || clean === 'NA' || clean === 'N/A' || clean === 'NONE') return '';
  return clean;
}

/**
 * Tokenizes text into significant keywords, keeping digits (e.g. '5') and alphanumeric models (e.g. 's24').
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => (w.length > 1 || /\d/.test(w)) && !STOP_WORDS.has(w));
  return Array.from(new Set(normalized));
}

/**
 * Evaluates whether a WTS product and a WTB request match.
 */
export function areItemsMatching(
  product: { title: string; brand?: string | null; barcode_or_sku?: string | null; unit_price?: number },
  wtb: { product_name: string; barcode_or_sku?: string | null; target_price?: number }
): { isMatch: boolean; matchType: MatchType; confidence: number } {
  const normProdBarcode = normalizeBarcode(product.barcode_or_sku);
  const normWtbBarcode = normalizeBarcode(wtb.barcode_or_sku);

  // 1. Exact Barcode Match (Highest Priority)
  if (normProdBarcode && normWtbBarcode && normProdBarcode === normWtbBarcode) {
    return { isMatch: true, matchType: 'exact_barcode', confidence: 100 };
  }

  // 2. Keyword / Title Matching
  const prodTokens = extractKeywords(`${product.brand || ''} ${product.title || ''}`);
  const wtbTokens = extractKeywords(wtb.product_name || '');

  if (prodTokens.length === 0 || wtbTokens.length === 0) {
    return { isMatch: false, matchType: 'title_keyword', confidence: 0 };
  }

  // Count intersecting tokens
  let matchCount = 0;
  for (const token of wtbTokens) {
    if (prodTokens.includes(token)) {
      matchCount += 1;
    } else {
      // Check partial substring match (e.g. 'ps5' containing '5', or 'playstation' matching 'ps')
      const hasPartial = prodTokens.some(
        (pt) => (pt.includes(token) || token.includes(pt)) && Math.min(pt.length, token.length) >= 2
      );
      if (hasPartial) {
        matchCount += 0.8;
      }
    }
  }

  // Check distinct version numbers (e.g. 14 vs 15, or s23 vs s24). Exclude common capacities (64, 128, 256, 512, 1)
  const capacityNumbers = new Set(['64', '128', '256', '512', '1024', '1', '2']);
  const wtbGenNumbers = wtbTokens.filter((t) => /^\d+$/.test(t) && !capacityNumbers.has(t));
  const prodGenNumbers = prodTokens.filter((t) => /^\d+$/.test(t) && !capacityNumbers.has(t));

  if (wtbGenNumbers.length > 0 && prodGenNumbers.length > 0) {
    const hasGenMismatch = !wtbGenNumbers.some((num) => prodGenNumbers.includes(num));
    if (hasGenMismatch) {
      return { isMatch: false, matchType: 'title_keyword', confidence: 0 };
    }
  }

  const overlapRatio = matchCount / Math.min(wtbTokens.length, prodTokens.length);

  // Match if at least 2 significant tokens match and overlap ratio is >= 50%
  if (matchCount >= 2 && overlapRatio >= 0.5) {
    const confidence = Math.min(95, Math.round(75 + overlapRatio * 20));
    return { isMatch: true, matchType: 'title_keyword', confidence };
  }

  return { isMatch: false, matchType: 'title_keyword', confidence: 0 };
}

/**
 * Client-side helper to read stored matches from localStorage.
 */
export function getStoredMatches(): TradeMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Client-side helper to save matches to localStorage and dispatch update event.
 */
export function saveStoredMatches(matches: TradeMatch[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: matches }));
  } catch {
    // ignore
  }
}

/**
 * Appends new matches to the client storage (avoiding duplicates).
 */
export function appendClientMatches(newMatches: TradeMatch[]): void {
  if (typeof window === 'undefined' || newMatches.length === 0) return;
  const existing = getStoredMatches();
  const existingIds = new Set(existing.map((m) => m.id));

  const toAdd = newMatches.filter((m) => !existingIds.has(m.id));
  if (toAdd.length > 0) {
    saveStoredMatches([...toAdd, ...existing]);
  }
}

/**
 * Retrieves matches filtered for a specific user (either as buyer or seller).
 */
export function getUserMatches(
  companyId?: string,
  userEmail?: string,
  allMatches?: TradeMatch[]
): TradeMatch[] {
  const list = allMatches || getStoredMatches();
  if (!companyId && !userEmail) return list;

  const emailNorm = userEmail?.toLowerCase().trim() || '';

  return list.filter((m) => {
    const isBuyer =
      (companyId && m.buyerCompanyId === companyId) ||
      (emailNorm && m.buyerEmail?.toLowerCase() === emailNorm);

    const isSeller =
      (companyId && m.sellerCompanyId === companyId) ||
      (emailNorm && m.sellerEmail?.toLowerCase() === emailNorm);

    if (isBuyer && m.dismissedByBuyer) return false;
    if (isSeller && m.dismissedBySeller) return false;

    return isBuyer || isSeller;
  });
}

/**
 * Dismisses a match for the current user.
 */
export function dismissMatch(matchId: string, isBuyer: boolean): void {
  const list = getStoredMatches();
  const updated = list.map((m) => {
    if (m.id === matchId) {
      return isBuyer
        ? { ...m, dismissedByBuyer: true }
        : { ...m, dismissedBySeller: true };
    }
    return m;
  });
  saveStoredMatches(updated);
}

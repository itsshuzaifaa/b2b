import fs from 'fs';
import path from 'path';

declare global {
  // eslint-disable-next-line no-var
  var __b2b_dispatched_kyc_set: Set<string> | undefined;
}

const dispatchedSet: Set<string> = global.__b2b_dispatched_kyc_set || new Set<string>();
global.__b2b_dispatched_kyc_set = dispatchedSet;

const KYC_CACHE_FILE = path.join(
  process.env.VERCEL ? '/tmp' : process.cwd(),
  '.b2b_dispatched_kyc.json'
);

export function loadDispatchedCache(): Set<string> {
  try {
    if (fs.existsSync(KYC_CACHE_FILE)) {
      const raw = fs.readFileSync(KYC_CACHE_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item) dispatchedSet.add(String(item).toLowerCase().trim());
        }
      }
    }
  } catch {}
  return dispatchedSet;
}

export function persistDispatchedCache(): void {
  try {
    fs.writeFileSync(KYC_CACHE_FILE, JSON.stringify(Array.from(dispatchedSet)), 'utf8');
  } catch {}
}

export function markKycDispatched(email: string): void {
  if (!email) return;
  dispatchedSet.add(email.toLowerCase().trim());
  persistDispatchedCache();
}

export function isKycAlreadyDispatched(email: string): boolean {
  if (!email) return false;
  loadDispatchedCache();
  return dispatchedSet.has(email.toLowerCase().trim());
}

export function clearDispatchedKycCache(): void {
  dispatchedSet.clear();
  try {
    if (fs.existsSync(KYC_CACHE_FILE)) {
      fs.unlinkSync(KYC_CACHE_FILE);
    }
  } catch {}
}

// Initialize on module load
loadDispatchedCache();

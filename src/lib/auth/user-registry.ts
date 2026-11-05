import fs from 'fs';
import path from 'path';

export interface RegisteredUserRecord {
  id: string;
  email: string;
  username: string;
  plainPassword?: string;
  firstName?: string;
  lastName?: string;
  contactName: string;
  companyName: string;
  companyId: string;
  phone?: string | null;
  role: 'seller' | 'buyer' | 'admin';
  tier: 'bronze' | 'silver' | 'gold';
  approval_status: 'pending' | 'approved' | 'suspended';
  emailConfirmed: boolean;
  createdAt: string;
  updatedAt?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __b2b_user_registry_store: Map<string, RegisteredUserRecord> | undefined;
}

const registryStore: Map<string, RegisteredUserRecord> =
  global.__b2b_user_registry_store || new Map<string, RegisteredUserRecord>();
global.__b2b_user_registry_store = registryStore;

// Status overrides store (handles admin approvals and suspensions in serverless)
const OVERRIDES_FILE_PATH = path.join(
  process.env.VERCEL ? '/tmp' : process.cwd(),
  '.b2b_status_overrides.json'
);

declare global {
  // eslint-disable-next-line no-var
  var __b2b_status_overrides_store: Map<string, { approval_status: 'pending' | 'approved' | 'suspended'; account_status: string; tier?: string }> | undefined;
}

const statusOverridesStore: Map<string, { approval_status: 'pending' | 'approved' | 'suspended'; account_status: string; tier?: string }> =
  global.__b2b_status_overrides_store || new Map();
global.__b2b_status_overrides_store = statusOverridesStore;

function loadPersistedOverrides(): void {
  try {
    if (fs.existsSync(OVERRIDES_FILE_PATH)) {
      const raw = fs.readFileSync(OVERRIDES_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object') {
            statusOverridesStore.set(k.toLowerCase().trim(), v as any);
          }
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

function persistOverrides(): void {
  try {
    const obj: Record<string, any> = {};
    for (const [k, v] of statusOverridesStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(OVERRIDES_FILE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch {
    // Ignore write errors in serverless
  }
}

loadPersistedOverrides();

export function setServerStatusOverride(
  identifier: string,
  status: 'pending' | 'approved' | 'suspended',
  tier?: string
): void {
  if (!identifier) return;
  loadPersistedOverrides();
  const clean = identifier.toLowerCase().trim();
  const override = {
    approval_status: status,
    account_status: status === 'approved' ? 'active' : status === 'suspended' ? 'suspended' : 'pending',
    tier,
  };
  statusOverridesStore.set(clean, override);
  persistOverrides();
}

export function getServerStatusOverride(
  identifier: string
): { approval_status: 'pending' | 'approved' | 'suspended'; account_status: string; tier?: string } | null {
  if (!identifier) return null;
  loadPersistedOverrides();
  return statusOverridesStore.get(identifier.toLowerCase().trim()) || null;
}

// File persistence helper (handles both local dev and Vercel serverless /tmp)
const CACHE_FILE_PATH = path.join(
  process.env.VERCEL ? '/tmp' : process.cwd(),
  '.b2b_user_registry.json'
);

function loadPersistedRegistry(): void {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const u of parsed) {
          if (u.email) registryStore.set(u.email.toLowerCase().trim(), u);
          if (u.username) registryStore.set(u.username.toLowerCase().trim(), u);
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

function persistRegistry(): void {
  try {
    const list: RegisteredUserRecord[] = [];
    const seen = new Set<string>();
    for (const record of registryStore.values()) {
      if (!seen.has(record.email.toLowerCase())) {
        seen.add(record.email.toLowerCase());
        list.push(record);
      }
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // Ignore write errors in serverless environments
  }
}

// Initial load on server startup
loadPersistedRegistry();

// Seed platform admin account (Platform Desk)
const SEED_USERS: RegisteredUserRecord[] = [
  {
    id: 'usr_admin_b2b_001',
    email: 'admin@b2blink.eu',
    username: 'admin',
    plainPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'B2bLink2026!Admin',
    contactName: 'Platform Administrator',
    companyName: 'B2B LINK European Trade Desk',
    companyId: 'facbb93f-080f-480f-b54b-8ef26664da86',
    phone: '+44 20 7946 0991',
    role: 'admin',
    tier: 'gold',
    approval_status: 'approved',
    emailConfirmed: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

export function registerUserAliases(u: RegisteredUserRecord): void {
  const emailKey = u.email.toLowerCase().trim();
  const usernameKey = (u.username || '').toLowerCase().trim();
  const emailPrefix = emailKey.split('@')[0].trim();

  registryStore.set(emailKey, u);
  if (usernameKey) registryStore.set(usernameKey, u);
  if (emailPrefix) registryStore.set(emailPrefix, u);

  // Platform administrator aliases
  if (emailKey === 'admin@b2blink.eu') {
    registryStore.set('admin', u);
    registryStore.set('administrator', u);
    registryStore.set('b2blink', u);
  }
}

for (const u of SEED_USERS) {
  registerUserAliases(u);
}

/**
 * Completely purges all non-admin registered users and server status overrides
 */
export function purgeAllNonAdminUsers(): void {
  registryStore.clear();
  statusOverridesStore.clear();

  for (const u of SEED_USERS) {
    registerUserAliases(u);
  }

  persistRegistry();
  persistOverrides();
}

/**
 * Registers or updates a user in the server-side registry.
 */
export function registerUserAccount(account: RegisteredUserRecord): RegisteredUserRecord {
  const emailKey = account.email.toLowerCase().trim();
  const usernameKey = account.username.toLowerCase().trim();

  const record: RegisteredUserRecord = {
    ...account,
    email: emailKey,
    username: usernameKey,
    updatedAt: new Date().toISOString(),
  };

  registerUserAliases(record);
  persistRegistry();
  return record;
}

/**
 * Finds user by username (case-insensitive with robust prefix and alias support).
 */
export function findUserByUsername(username: string): RegisteredUserRecord | null {
  loadPersistedRegistry();
  if (!username) return null;
  const clean = username.trim().toLowerCase();
  const cleanAlpha = clean.replace(/[^a-z0-9]/g, '');

  // 1. Direct registry lookup
  if (registryStore.has(clean)) return registryStore.get(clean)!;
  if (registryStore.has(cleanAlpha)) return registryStore.get(cleanAlpha)!;

  // 2. Scan all registered users
  for (const u of registryStore.values()) {
    const uEmailPrefix = (u.email || '').split('@')[0].toLowerCase().trim();
    const uName = (u.username || '').toLowerCase().trim();
    const uNameAlpha = uName.replace(/[^a-z0-9]/g, '');
    const uCompanyAlpha = (u.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const uContactAlpha = (u.contactName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (
      uName === clean ||
      uNameAlpha === cleanAlpha ||
      uEmailPrefix === clean ||
      uEmailPrefix === cleanAlpha ||
      (cleanAlpha.length >= 3 && uCompanyAlpha === cleanAlpha) ||
      (cleanAlpha.length >= 3 && uContactAlpha === cleanAlpha) ||
      (clean.length >= 4 && uEmailPrefix.includes(clean)) ||
      (clean.length >= 4 && clean.includes(uEmailPrefix))
    ) {
      return u;
    }
  }

  return null;
}

/**
 * Finds user by email (case-insensitive).
 */
export function findUserByEmail(email: string): RegisteredUserRecord | null {
  loadPersistedRegistry();
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  return registryStore.get(clean) || null;
}

/**
 * Finds user by identifier (either username or email).
 */
export function findUserByIdentifier(identifier: string): RegisteredUserRecord | null {
  loadPersistedRegistry();
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  return (
    registryStore.get(clean) ||
    findUserByUsername(identifier) ||
    findUserByEmail(identifier) ||
    null
  );
}

/**
 * Marks user email as confirmed upon successful OTP verification.
 */
export function confirmUserEmail(email: string): boolean {
  loadPersistedRegistry();
  const clean = email.trim().toLowerCase();
  const record = registryStore.get(clean);
  if (record) {
    record.emailConfirmed = true;
    record.updatedAt = new Date().toISOString();
    registryStore.set(clean, record);
    if (record.username) {
      registryStore.set(record.username.toLowerCase().trim(), record);
    }
    persistRegistry();
    return true;
  }
  return false;
}

/**
 * Updates membership tier and approval status for a registered user.
 */
export function updateUserTierAndStatus(
  email: string,
  tier: 'bronze' | 'silver' | 'gold',
  status: 'pending' | 'approved' | 'suspended',
  meta?: {
    contactName?: string;
    companyName?: string;
    companyId?: string;
    role?: 'seller' | 'buyer' | 'admin';
  }
): boolean {
  loadPersistedRegistry();
  const clean = email.trim().toLowerCase();

  // Save server override by email and companyId
  setServerStatusOverride(clean, status, tier);
  if (meta?.companyId) {
    setServerStatusOverride(meta.companyId, status, tier);
  }

  let record = registryStore.get(clean);
  if (record) {
    record.tier = tier || record.tier || 'bronze';
    record.approval_status = status;
    record.updatedAt = new Date().toISOString();
    if (meta?.companyName) record.companyName = meta.companyName;
    if (meta?.contactName) record.contactName = meta.contactName;
    if (meta?.companyId) record.companyId = meta.companyId;
    if (meta?.role) record.role = meta.role;
  } else {
    record = {
      id: meta?.companyId || `usr_${Date.now()}`,
      email: clean,
      username: clean.split('@')[0],
      plainPassword: 'Member2026!',
      contactName: meta?.contactName || 'Wholesale Member',
      companyName: meta?.companyName || 'Enterprise Partner',
      companyId: meta?.companyId || `comp_${Date.now()}`,
      role: meta?.role || 'seller',
      tier: tier || 'bronze',
      approval_status: status,
      emailConfirmed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  registryStore.set(clean, record);
  if (record.username) {
    registryStore.set(record.username.toLowerCase().trim(), record);
  }
  persistRegistry();
  return true;
}

/**
 * Returns all unique registered accounts from the registry.
 */
export function getAllRegisteredUsers(): RegisteredUserRecord[] {
  loadPersistedRegistry();
  const list: RegisteredUserRecord[] = [];
  const seen = new Set<string>();
  for (const record of registryStore.values()) {
    const key = record.email.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      const override = getServerStatusOverride(key) || (record.companyId ? getServerStatusOverride(record.companyId) : null);
      if (override) {
        list.push({
          ...record,
          approval_status: override.approval_status,
          tier: (override.tier as any) || record.tier,
        });
      } else {
        list.push(record);
      }
    }
  }
  return list;
}

/**
 * Updates a registered user's password.
 */
export function updateUserPassword(identifier: string, newPassword: string): boolean {
  loadPersistedRegistry();
  const clean = identifier.trim().toLowerCase();
  const record = registryStore.get(clean);
  if (record) {
    record.plainPassword = newPassword;
    record.updatedAt = new Date().toISOString();
    registryStore.set(record.email.toLowerCase().trim(), record);
    if (record.username) {
      registryStore.set(record.username.toLowerCase().trim(), record);
    }
    persistRegistry();
    return true;
  }
  return false;
}

/**
 * Checks if a user exists in registry by email or username.
 */
export function userExists(identifier: string): boolean {
  loadPersistedRegistry();
  const clean = identifier.trim().toLowerCase();
  return registryStore.has(clean);
}

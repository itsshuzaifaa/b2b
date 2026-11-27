import crypto from 'crypto';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import {
  ALL_ADMIN_PERMISSIONS,
  hasAdminPermission,
  type AdminPermission,
  type AdminRole,
  type AdminStatus,
} from '@/lib/admin/permissions';

export interface AdminStaffRecord {
  id: string;
  user_id: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  permissions: AdminPermission[];
  invited_by?: string | null;
  invited_at?: string | null;
  onboarded_at?: string | null;
  created_at?: string | null;
  notes?: string | null;
}

export function hashInviteToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateInviteToken(): { rawToken: string; tokenHash: string; expiresAt: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { rawToken, tokenHash, expiresAt };
}

function normalizePermissions(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw)) return [];
  const validSet = new Set<string>(ALL_ADMIN_PERMISSIONS);
  return raw.filter((p): p is AdminPermission => typeof p === 'string' && validSet.has(p));
}

/**
 * Resolves a verified admin/staff profile from `public.admins` + `user.app_metadata`.
 * Returns null if the user is not an admin/staff or is currently invited/suspended.
 */
export async function resolveActiveAdminContext(user: User | null): Promise<AdminStaffRecord | null> {
  if (!user) return null;

  const appMeta = (user.app_metadata || {}) as Record<string, unknown>;
  const appRole = typeof appMeta.role === 'string' ? appMeta.role.toLowerCase() : '';
  const isAppAdmin = appMeta.is_admin === true || appRole === 'admin';
  const appAdminRole = appMeta.admin_role === 'staff' ? 'staff' : appMeta.admin_role === 'super_admin' ? 'super_admin' : null;
  const appStaffStatus = typeof appMeta.staff_status === 'string' ? (appMeta.staff_status as AdminStatus) : null;
  const appPermissions = normalizePermissions(appMeta.staff_permissions);

  let dbRow: Record<string, unknown> | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('admins')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      dbRow = data as Record<string, unknown>;
    }
  } catch {
    // ignore if table unavailable
  }

  if (!isAppAdmin && !dbRow) {
    return null;
  }

  const email = (typeof dbRow?.email === 'string' ? dbRow.email : user.email || '').toLowerCase().trim();
  const isPrimaryAdmin =
    email === 'admin@b2blink.eu' ||
    dbRow?.notes === 'Primary Platform Administrator' ||
    appAdminRole === 'super_admin' ||
    dbRow?.role === 'super_admin';

  const role: AdminRole = isPrimaryAdmin
    ? 'super_admin'
    : dbRow?.role === 'staff' || appAdminRole === 'staff'
      ? 'staff'
      : 'super_admin';

  const status: AdminStatus = isPrimaryAdmin
    ? 'active'
    : ((dbRow?.status as AdminStatus | undefined) || appStaffStatus || 'active');

  // Invited or suspended staff cannot access admin routes
  if (status !== 'active') {
    return null;
  }

  const dbPermissions = normalizePermissions(dbRow?.permissions);
  const permissions: AdminPermission[] =
    role === 'super_admin'
      ? [...ALL_ADMIN_PERMISSIONS]
      : dbPermissions.length > 0
        ? dbPermissions
        : appPermissions;

  return {
    id: (dbRow?.id as string) || user.id,
    user_id: user.id,
    email,
    role,
    status,
    full_name:
      (dbRow?.full_name as string | null) ??
      (appMeta.staff_full_name as string | null) ??
      (user.user_metadata?.full_name as string | null) ??
      null,
    phone:
      (dbRow?.phone as string | null) ??
      (appMeta.staff_phone as string | null) ??
      (user.user_metadata?.phone as string | null) ??
      null,
    avatar_url:
      (dbRow?.avatar_url as string | null) ??
      (appMeta.staff_avatar_url as string | null) ??
      (user.user_metadata?.avatar_url as string | null) ??
      null,
    job_title:
      (dbRow?.job_title as string | null) ??
      (appMeta.staff_job_title as string | null) ??
      null,
    permissions,
    invited_by: (dbRow?.invited_by as string | null) ?? null,
    invited_at: (dbRow?.invited_at as string | null) ?? null,
    onboarded_at: (dbRow?.onboarded_at as string | null) ?? null,
    created_at: (dbRow?.created_at as string | null) ?? null,
    notes: (dbRow?.notes as string | null) ?? null,
  };
}

/**
 * Helper to check if a resolved AdminStaffRecord has a permission.
 */
export function adminHasPermission(
  adminContext: AdminStaffRecord | null,
  permission: AdminPermission
): boolean {
  if (!adminContext || adminContext.status !== 'active') return false;
  return hasAdminPermission(adminContext.role, adminContext.permissions, permission);
}

/**
 * Safely writes extended fields to `public.admins`, falling back cleanly
 * if optional migration columns haven't been created in PostgreSQL yet.
 */
export async function upsertAdminRowSafe(
  userId: string,
  email: string,
  extendedFields: Record<string, unknown>,
  fallbackNotes?: string
): Promise<void> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminsTable = (admin as any).from('admins');
  const { data: existing } = await adminsTable
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  const fullPayload = {
    user_id: userId,
    email: email.toLowerCase().trim(),
    ...extendedFields,
  };

  if (existing?.id) {
    const { error } = await adminsTable.update(extendedFields).eq('id', existing.id);
    if (error && error.message?.toLowerCase().includes('column')) {
      if (fallbackNotes !== undefined) {
        await adminsTable.update({ notes: fallbackNotes }).eq('id', existing.id);
      }
    }
  } else {
    const { error } = await adminsTable.insert(fullPayload);
    if (error && error.message?.toLowerCase().includes('column')) {
      await adminsTable.insert({
        user_id: userId,
        email: email.toLowerCase().trim(),
        notes: fallbackNotes || 'Staff Member',
      });
    }
  }
}

/**
 * Lists all admin & staff members by combining `public.admins` and Supabase Auth `app_metadata`.
 */
export async function listAllAdminStaff(): Promise<AdminStaffRecord[]> {
  const admin = createAdminClient();
  const { data: dbRows } = await admin
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true });

  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUsersById = new Map<string, User>();
  for (const u of authList?.users || []) {
    authUsersById.set(u.id, u);
  }

  const seenUserIds = new Set<string>();
  const results: AdminStaffRecord[] = [];

  for (const row of (dbRows || []) as Array<Record<string, unknown>>) {
    const uid = String(row.user_id || '');
    if (!uid) continue;
    seenUserIds.add(uid);
    const authUser = authUsersById.get(uid);
    const appMeta = (authUser?.app_metadata || {}) as Record<string, unknown>;
    const email = String(row.email || authUser?.email || '').toLowerCase().trim();

    const isPrimary =
      email === 'admin@b2blink.eu' ||
      row.notes === 'Primary Platform Administrator' ||
      row.role === 'super_admin' ||
      appMeta.admin_role === 'super_admin';

    const role: AdminRole = isPrimary
      ? 'super_admin'
      : row.role === 'staff' || appMeta.admin_role === 'staff'
        ? 'staff'
        : 'super_admin';

    const status: AdminStatus = isPrimary
      ? 'active'
      : ((row.status as AdminStatus | undefined) || (appMeta.staff_status as AdminStatus | undefined) || 'active');

    const dbPerms = normalizePermissions(row.permissions);
    const appPerms = normalizePermissions(appMeta.staff_permissions);

    results.push({
      id: String(row.id || uid),
      user_id: uid,
      email,
      role,
      status,
      full_name:
        (row.full_name as string | null) ??
        (appMeta.staff_full_name as string | null) ??
        null,
      phone:
        (row.phone as string | null) ??
        (appMeta.staff_phone as string | null) ??
        null,
      avatar_url:
        (row.avatar_url as string | null) ??
        (appMeta.staff_avatar_url as string | null) ??
        null,
      job_title:
        (row.job_title as string | null) ??
        (appMeta.staff_job_title as string | null) ??
        null,
      permissions: role === 'super_admin' ? [...ALL_ADMIN_PERMISSIONS] : dbPerms.length > 0 ? dbPerms : appPerms,
      invited_at: (row.invited_at as string | null) ?? (appMeta.staff_invited_at as string | null) ?? null,
      onboarded_at: (row.onboarded_at as string | null) ?? (appMeta.staff_onboarded_at as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? authUser?.created_at ?? null,
      notes: (row.notes as string | null) ?? null,
    });
  }

  // Include any staff auth users not yet in public.admins
  for (const u of authList?.users || []) {
    if (seenUserIds.has(u.id)) continue;
    const appMeta = (u.app_metadata || {}) as Record<string, unknown>;
    if (appMeta.is_admin === true || appMeta.role === 'admin') {
      const role: AdminRole = appMeta.admin_role === 'staff' ? 'staff' : 'super_admin';
      const status: AdminStatus = (appMeta.staff_status as AdminStatus | undefined) || 'active';
      results.push({
        id: u.id,
        user_id: u.id,
        email: (u.email || '').toLowerCase().trim(),
        role,
        status,
        full_name: (appMeta.staff_full_name as string | null) ?? null,
        phone: (appMeta.staff_phone as string | null) ?? null,
        avatar_url: (appMeta.staff_avatar_url as string | null) ?? null,
        job_title: (appMeta.staff_job_title as string | null) ?? null,
        permissions: role === 'super_admin' ? [...ALL_ADMIN_PERMISSIONS] : normalizePermissions(appMeta.staff_permissions),
        invited_at: (appMeta.staff_invited_at as string | null) ?? null,
        onboarded_at: (appMeta.staff_onboarded_at as string | null) ?? null,
        created_at: u.created_at,
      });
    }
  }

  return results;
}

/**
 * Finds an invited staff user by raw invite token.
 */
export async function findStaffInviteByToken(rawToken: string): Promise<{
  user: User;
  email: string;
  permissions: AdminPermission[];
  expiresAt: string | null;
  status: AdminStatus;
} | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashInviteToken(rawToken);
  const admin = createAdminClient();

  // 1. Try public.admins invite_token_hash if column exists
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('admins')
      .select('user_id, email, permissions, invite_expires_at, status')
      .eq('invite_token_hash', tokenHash)
      .limit(1)
      .maybeSingle();

    if (!error && data?.user_id) {
      const { data: userRes } = await admin.auth.admin.getUserById(data.user_id);
      if (userRes?.user) {
        const appMeta = (userRes.user.app_metadata || {}) as Record<string, unknown>;
        const perms = normalizePermissions(data.permissions);
        return {
          user: userRes.user,
          email: data.email || userRes.user.email || '',
          permissions: perms.length > 0 ? perms : normalizePermissions(appMeta.staff_permissions),
          expiresAt: data.invite_expires_at || (appMeta.invite_expires_at as string | null) || null,
          status: (data.status as AdminStatus) || (appMeta.staff_status as AdminStatus) || 'invited',
        };
      }
    }
  } catch {
    // Column might not exist yet; fall through to auth app_metadata lookup
  }

  // 2. Fallback: search auth users app_metadata.invite_token_hash
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of authList?.users || []) {
    const appMeta = (u.app_metadata || {}) as Record<string, unknown>;
    if (appMeta.invite_token_hash === tokenHash) {
      return {
        user: u,
        email: u.email || '',
        permissions: normalizePermissions(appMeta.staff_permissions),
        expiresAt: (appMeta.invite_expires_at as string | null) || null,
        status: (appMeta.staff_status as AdminStatus) || 'invited',
      };
    }
  }

  return null;
}

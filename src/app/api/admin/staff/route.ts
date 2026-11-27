import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import {
  ALL_ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_GROUPS,
  type AdminPermission,
  type AdminStatus,
} from '@/lib/admin/permissions';
import {
  generateInviteToken,
  listAllAdminStaff,
  upsertAdminRowSafe,
} from '@/lib/admin/staff-store';
import { sendStaffInviteEmail } from '@/lib/email/dispatcher';
import { getDynamicAppUrl } from '@/lib/utils/app-url';

const PERMISSION_LABEL_MAP = new Map<string, string>(
  ADMIN_PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, `${g.pageLabel}: ${p.label}`]))
);

function sanitizePermissions(input: unknown): AdminPermission[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set<string>(ALL_ADMIN_PERMISSIONS);
  return Array.from(new Set(input.filter((p): p is AdminPermission => typeof p === 'string' && valid.has(p))));
}

/**
 * GET /api/admin/staff
 * Lists all admin & staff members. Requires `staff.view`.
 */
export async function GET() {
  const auth = await requireAdmin('staff.view');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const staff = await listAllAdminStaff();
    return NextResponse.json({ success: true, staff });
  } catch (err) {
    console.error('[GET ADMIN STAFF ERROR]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load staff members.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/staff
 * Invites a new staff member by email only + selected permissions.
 * Sends an email with a domain-safe /staff-setup?token=... link.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin('staff.manage');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const permissions = sanitizePermissions(body.permissions);

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid staff email address.' }, { status: 400 });
    }

    if (permissions.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one page or feature permission for this staff member.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const existingStaff = await listAllAdminStaff();
    const duplicate = existingStaff.find((s) => s.email === email);
    if (duplicate && duplicate.role === 'super_admin') {
      return NextResponse.json({ error: 'This email belongs to the primary Super Admin.' }, { status: 400 });
    }
    if (duplicate && duplicate.status === 'active') {
      return NextResponse.json(
        { error: 'An active staff member with this email already exists. Edit their permissions instead.' },
        { status: 409 }
      );
    }

    const { rawToken, tokenHash, expiresAt } = generateInviteToken();
    const nowIso = new Date().toISOString();

    let targetUserId = duplicate?.user_id || null;

    if (!targetUserId) {
      // Check if an auth user already exists with this email
      const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingAuthUser = (authList?.users || []).find(
        (u) => (u.email || '').toLowerCase().trim() === email
      );

      if (existingAuthUser) {
        targetUserId = existingAuthUser.id;
      } else {
        const tempPassword = crypto.randomBytes(24).toString('hex');
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: false,
          user_metadata: {
            role: 'admin',
            admin_role: 'staff',
          },
          app_metadata: {
            role: 'admin',
            is_admin: true,
            admin_role: 'staff',
            staff_status: 'invited',
            staff_permissions: permissions,
            invite_token_hash: tokenHash,
            invite_expires_at: expiresAt,
            staff_invited_at: nowIso,
          },
        });

        if (createErr || !created.user) {
          return NextResponse.json(
            { error: createErr?.message || 'Failed to provision staff auth account.' },
            { status: 400 }
          );
        }
        targetUserId = created.user.id;
      }
    }

    // Update app_metadata so permissions, status & invite token are tamper-proof in JWT
    const { data: existingAuth } = await admin.auth.admin.getUserById(targetUserId);
    const prevAppMeta = (existingAuth?.user?.app_metadata || {}) as Record<string, unknown>;
    await admin.auth.admin.updateUserById(targetUserId, {
      app_metadata: {
        ...prevAppMeta,
        role: 'admin',
        is_admin: true,
        admin_role: 'staff',
        staff_status: 'invited',
        staff_permissions: permissions,
        invite_token_hash: tokenHash,
        invite_expires_at: expiresAt,
        staff_invited_at: nowIso,
      },
    });

    await upsertAdminRowSafe(
      targetUserId,
      email,
      {
        role: 'staff',
        status: 'invited',
        permissions,
        invite_token_hash: tokenHash,
        invite_expires_at: expiresAt,
        invited_by: auth.user.id,
        invited_at: nowIso,
        notes: `Staff Member (${permissions.length} permissions)`,
      },
      `Staff Member (${permissions.length} permissions)`
    );

    const appUrl = await getDynamicAppUrl(request);
    const setupUrl = `${appUrl}/staff-setup?token=${encodeURIComponent(rawToken)}`;
    const permissionLabels = permissions.map((p) => PERMISSION_LABEL_MAP.get(p) || p);

    const emailRes = await sendStaffInviteEmail(email, {
      recipientEmail: email,
      invitedByEmail: auth.user.email || 'admin@b2blink.eu',
      permissionLabels,
      actionUrl: setupUrl,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailRes.success,
      setupUrl,
      message: emailRes.success
        ? `Invitation sent to ${email}. They can click the email link to complete their profile setup.`
        : `Staff invite created for ${email}, but email dispatch reported: ${emailRes.error || 'mock mode'}.`,
    });
  } catch (err) {
    console.error('[POST ADMIN STAFF ERROR]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to invite staff member.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/staff
 * Updates staff permissions, status (active/suspended), or resends invite email.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin('staff.manage');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const userId = String(body.userId || '').trim();
    const action = String(body.action || 'update');

    if (!userId) {
      return NextResponse.json({ error: 'Staff userId is required.' }, { status: 400 });
    }

    const allStaff = await listAllAdminStaff();
    const target = allStaff.find((s) => s.user_id === userId || s.id === userId);
    if (!target) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ error: 'Primary Super Admin cannot be modified here.' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: authData } = await admin.auth.admin.getUserById(target.user_id);
    const prevAppMeta = (authData?.user?.app_metadata || {}) as Record<string, unknown>;

    if (action === 'resend_invite') {
      const { rawToken, tokenHash, expiresAt } = generateInviteToken();
      const nowIso = new Date().toISOString();

      await admin.auth.admin.updateUserById(target.user_id, {
        app_metadata: {
          ...prevAppMeta,
          staff_status: 'invited',
          invite_token_hash: tokenHash,
          invite_expires_at: expiresAt,
          staff_invited_at: nowIso,
        },
      });

      await upsertAdminRowSafe(target.user_id, target.email, {
        status: 'invited',
        invite_token_hash: tokenHash,
        invite_expires_at: expiresAt,
        invited_at: nowIso,
      });

      const appUrl = await getDynamicAppUrl(request);
      const setupUrl = `${appUrl}/staff-setup?token=${encodeURIComponent(rawToken)}`;
      const permissionLabels = target.permissions.map((p) => PERMISSION_LABEL_MAP.get(p) || p);

      const emailRes = await sendStaffInviteEmail(target.email, {
        recipientEmail: target.email,
        invitedByEmail: auth.user.email || 'admin@b2blink.eu',
        permissionLabels,
        actionUrl: setupUrl,
      });

      return NextResponse.json({
        success: true,
        emailSent: emailRes.success,
        setupUrl,
        message: `New invitation link dispatched to ${target.email}.`,
      });
    }

    const nextPermissions =
      body.permissions !== undefined ? sanitizePermissions(body.permissions) : target.permissions;
    const nextStatus: AdminStatus =
      body.status === 'active' || body.status === 'suspended' || body.status === 'invited'
        ? body.status
        : target.status;

    await admin.auth.admin.updateUserById(target.user_id, {
      app_metadata: {
        ...prevAppMeta,
        staff_status: nextStatus,
        staff_permissions: nextPermissions,
      },
    });

    await upsertAdminRowSafe(target.user_id, target.email, {
      status: nextStatus,
      permissions: nextPermissions,
      notes: `Staff Member (${nextPermissions.length} permissions)`,
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${target.email} (${nextStatus}, ${nextPermissions.length} permissions).`,
    });
  } catch (err) {
    console.error('[PATCH ADMIN STAFF ERROR]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update staff member.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/staff
 * Revokes staff access by removing from `public.admins` and clearing admin `app_metadata`.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin('staff.manage');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const userId = (searchParams.get('userId') || '').trim();
    if (!userId) {
      return NextResponse.json({ error: 'userId query parameter is required.' }, { status: 400 });
    }

    const allStaff = await listAllAdminStaff();
    const target = allStaff.find((s) => s.user_id === userId || s.id === userId);
    if (!target) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ error: 'Primary Super Admin cannot be removed.' }, { status: 403 });
    }

    const admin = createAdminClient();
    await admin.from('admins').delete().eq('user_id', target.user_id);

    const { data: authData } = await admin.auth.admin.getUserById(target.user_id);
    if (authData?.user) {
      await admin.auth.admin.updateUserById(target.user_id, {
        app_metadata: {
          role: 'member',
          is_admin: false,
          admin_role: null,
          staff_status: 'suspended',
          staff_permissions: [],
          invite_token_hash: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Removed staff access for ${target.email}.`,
    });
  } catch (err) {
    console.error('[DELETE ADMIN STAFF ERROR]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to remove staff member.' },
      { status: 500 }
    );
  }
}

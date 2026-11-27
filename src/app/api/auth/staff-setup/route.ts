import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { ADMIN_PERMISSION_GROUPS } from '@/lib/admin/permissions';
import { findStaffInviteByToken, upsertAdminRowSafe } from '@/lib/admin/staff-store';
import { getFirstPermittedAdminRoute } from '@/lib/admin/permissions';

const PERM_LABEL_MAP = new Map<string, string>(
  ADMIN_PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, `${g.pageLabel}: ${p.label}`]))
);

/**
 * GET /api/auth/staff-setup?token=...
 * Validates a staff invitation token and returns the invited email + granted permissions.
 */
export async function GET(request: NextRequest) {
  const token = (new URL(request.url).searchParams.get('token') || '').trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Missing invitation token.' }, { status: 400 });
  }

  try {
    const invite = await findStaffInviteByToken(token);
    if (!invite) {
      return NextResponse.json(
        { valid: false, error: 'This invitation link is invalid or has already been used.' },
        { status: 404 }
      );
    }

    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { valid: false, error: 'This invitation link has expired. Please ask an administrator to resend it.' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      permissions: invite.permissions,
      permissionLabels: invite.permissions.map((p) => PERM_LABEL_MAP.get(p) || p),
    });
  } catch (err) {
    console.error('[GET STAFF SETUP ERROR]', err);
    return NextResponse.json({ valid: false, error: 'Failed to validate invitation.' }, { status: 500 });
  }
}

/**
 * POST /api/auth/staff-setup
 * Completes staff onboarding: sets name, phone, job title, optional avatar upload, and password.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = String(formData.get('token') || '').trim();
    const fullName = String(formData.get('fullName') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const jobTitle = String(formData.get('jobTitle') || '').trim();
    const password = String(formData.get('password') || '');
    const avatarFile = formData.get('avatar') as File | null;

    if (!token) {
      return NextResponse.json({ error: 'Missing invitation token.' }, { status: 400 });
    }
    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const invite = await findStaffInviteByToken(token);
    if (!invite) {
      return NextResponse.json(
        { error: 'This invitation link is invalid or has already been used.' },
        { status: 404 }
      );
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'This invitation link has expired. Please request a new invite.' },
        { status: 410 }
      );
    }

    const admin = createAdminClient();
    let avatarUrl: string | null = null;

    // Optional profile picture upload to public-assets bucket
    if (avatarFile && avatarFile.size > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(avatarFile.type)) {
        return NextResponse.json({ error: 'Profile picture must be JPG, PNG, WebP, or GIF.' }, { status: 400 });
      }
      if (avatarFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Profile picture must be under 5 MB.' }, { status: 400 });
      }

      const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'png';
      const storagePath = `staff-avatars/${invite.user.id}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      const { error: uploadErr } = await admin.storage
        .from('public-assets')
        .upload(storagePath, buffer, {
          contentType: avatarFile.type,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pubUrl } = admin.storage.from('public-assets').getPublicUrl(storagePath);
        avatarUrl = pubUrl?.publicUrl || null;
      } else {
        console.warn('[STAFF AVATAR UPLOAD NOTICE]', uploadErr.message);
      }
    }

    const nowIso = new Date().toISOString();
    const prevAppMeta = (invite.user.app_metadata || {}) as Record<string, unknown>;
    const prevUserMeta = (invite.user.user_metadata || {}) as Record<string, unknown>;

    const { error: updateErr } = await admin.auth.admin.updateUserById(invite.user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...prevUserMeta,
        full_name: fullName,
        phone: phone || null,
        job_title: jobTitle || null,
        avatar_url: avatarUrl,
      },
      app_metadata: {
        ...prevAppMeta,
        role: 'admin',
        is_admin: true,
        admin_role: 'staff',
        staff_status: 'active',
        staff_permissions: invite.permissions,
        staff_full_name: fullName,
        staff_phone: phone || null,
        staff_job_title: jobTitle || null,
        staff_avatar_url: avatarUrl,
        staff_onboarded_at: nowIso,
        invite_token_hash: null,
        invite_expires_at: null,
      },
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message || 'Failed to activate staff account.' }, { status: 400 });
    }

    await upsertAdminRowSafe(
      invite.user.id,
      invite.email,
      {
        role: 'staff',
        status: 'active',
        full_name: fullName,
        phone: phone || null,
        job_title: jobTitle || null,
        avatar_url: avatarUrl,
        permissions: invite.permissions,
        invite_token_hash: null,
        invite_expires_at: null,
        onboarded_at: nowIso,
        notes: `${fullName} (${invite.permissions.length} permissions)`,
      },
      `${fullName} (${invite.permissions.length} permissions)`
    );

    const landingRoute = getFirstPermittedAdminRoute('staff', invite.permissions);

    return NextResponse.json({
      success: true,
      email: invite.email,
      landingRoute,
      message: 'Your staff account is active! Signing you in now...',
    });
  } catch (err) {
    console.error('[POST STAFF SETUP ERROR]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to complete staff setup.' },
      { status: 500 }
    );
  }
}

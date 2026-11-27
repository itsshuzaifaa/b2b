import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { upsertAdminRowSafe } from '@/lib/admin/staff-store';

/**
 * GET /api/admin/profile
 * Returns the authenticated admin/staff member's personal profile.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  return NextResponse.json({
    success: true,
    profile: {
      email: auth.adminContext.email,
      role: auth.adminContext.role,
      full_name: auth.adminContext.full_name || '',
      phone: auth.adminContext.phone || '',
      job_title: auth.adminContext.job_title || '',
      avatar_url: auth.adminContext.avatar_url || null,
      permissions: auth.adminContext.permissions,
    },
  });
}

/**
 * PATCH /api/admin/profile
 * Updates the authenticated admin/staff member's personal profile & avatar.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const contentType = request.headers.get('content-type') || '';
    let fullName = '';
    let phone = '';
    let jobTitle = '';
    let avatarFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      fullName = String(formData.get('fullName') || '').trim();
      phone = String(formData.get('phone') || '').trim();
      jobTitle = String(formData.get('jobTitle') || '').trim();
      avatarFile = formData.get('avatar') as File | null;
    } else {
      const body = await request.json();
      fullName = String(body.fullName || '').trim();
      phone = String(body.phone || '').trim();
      jobTitle = String(body.jobTitle || '').trim();
    }

    const admin = createAdminClient();
    let avatarUrl = auth.adminContext.avatar_url || null;

    if (avatarFile && avatarFile.size > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(avatarFile.type)) {
        return NextResponse.json({ error: 'Profile picture must be JPG, PNG, WebP, or GIF.' }, { status: 400 });
      }
      if (avatarFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Profile picture must be under 5 MB.' }, { status: 400 });
      }

      const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'png';
      const storagePath = `staff-avatars/${auth.user.id}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      const { error: uploadErr } = await admin.storage
        .from('public-assets')
        .upload(storagePath, buffer, {
          contentType: avatarFile.type,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pubUrl } = admin.storage.from('public-assets').getPublicUrl(storagePath);
        avatarUrl = pubUrl?.publicUrl || avatarUrl;
      }
    }

    const prevAppMeta = (auth.user.app_metadata || {}) as Record<string, unknown>;
    const prevUserMeta = (auth.user.user_metadata || {}) as Record<string, unknown>;

    await admin.auth.admin.updateUserById(auth.user.id, {
      user_metadata: {
        ...prevUserMeta,
        full_name: fullName || prevUserMeta.full_name,
        phone: phone || null,
        job_title: jobTitle || null,
        avatar_url: avatarUrl,
      },
      app_metadata: {
        ...prevAppMeta,
        staff_full_name: fullName || prevAppMeta.staff_full_name,
        staff_phone: phone || null,
        staff_job_title: jobTitle || null,
        staff_avatar_url: avatarUrl,
      },
    });

    await upsertAdminRowSafe(auth.user.id, auth.adminContext.email, {
      full_name: fullName || null,
      phone: phone || null,
      job_title: jobTitle || null,
      avatar_url: avatarUrl,
    });

    return NextResponse.json({
      success: true,
      profile: {
        email: auth.adminContext.email,
        full_name: fullName,
        phone,
        job_title: jobTitle,
        avatar_url: avatarUrl,
      },
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    console.error('[PATCH ADMIN PROFILE ERROR]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update profile.' },
      { status: 500 }
    );
  }
}

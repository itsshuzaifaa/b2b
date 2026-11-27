/**
 * Central Registry of Site-Admin Pages & Feature Permissions.
 * Used across server API guards, layout/route protection, and Staff Management UI.
 */

export type AdminRole = 'super_admin' | 'staff';
export type AdminStatus = 'invited' | 'active' | 'suspended';

export type AdminPermission =
  | 'overview.view'
  | 'overview.broadcast_sellers'
  | 'users.view'
  | 'users.approve_reject'
  | 'users.edit_tier'
  | 'users.suspend_delete'
  | 'users.create_account'
  | 'payments.view'
  | 'payments.manage'
  | 'campaigns.view'
  | 'campaigns.send'
  | 'queries.view'
  | 'queries.reply'
  | 'listings.view'
  | 'listings.moderate'
  | 'listings.bulk_upload'
  | 'messages.view'
  | 'messages.send'
  | 'staff.view'
  | 'staff.manage';

export interface PermissionItem {
  key: AdminPermission;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  pageLabel: string;
  href: string;
  viewPermission: AdminPermission;
  description: string;
  permissions: PermissionItem[];
}

export const ADMIN_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'overview',
    pageLabel: 'Overview Dashboard',
    href: '/site-admin',
    viewPermission: 'overview.view',
    description: 'Platform KPIs, pending approvals summary, and quick actions.',
    permissions: [
      {
        key: 'overview.view',
        label: 'View Overview Dashboard',
        description: 'Access the main /site-admin overview and KPI metrics.',
      },
      {
        key: 'overview.broadcast_sellers',
        label: 'Send Platform Broadcasts',
        description: 'Send global broadcast announcements to all verified sellers.',
      },
    ],
  },
  {
    id: 'users',
    pageLabel: 'Accounts (Buyers & Sellers)',
    href: '/site-admin/users',
    viewPermission: 'users.view',
    description: 'Manage registered companies, verification approvals, and tiers.',
    permissions: [
      {
        key: 'users.view',
        label: 'View Accounts List',
        description: 'Browse and inspect buyer/seller accounts.',
      },
      {
        key: 'users.approve_reject',
        label: 'Approve / Reject Accounts',
        description: 'Approve pending KYC registrations or reject applications.',
      },
      {
        key: 'users.edit_tier',
        label: 'Edit Membership Tiers',
        description: 'Upgrade or downgrade Bronze, Silver, and Gold memberships.',
      },
      {
        key: 'users.suspend_delete',
        label: 'Suspend / Delete Accounts',
        description: 'Suspend, reactivate, or permanently delete user accounts.',
      },
      {
        key: 'users.create_account',
        label: 'Create Member Accounts',
        description: 'Manually provision new buyer/seller accounts from admin.',
      },
    ],
  },
  {
    id: 'payments',
    pageLabel: 'Payment Records',
    href: '/site-admin/payments',
    viewPermission: 'payments.view',
    description: 'View membership invoices, billing transactions, and payment statuses.',
    permissions: [
      {
        key: 'payments.view',
        label: 'View Payment Records',
        description: 'Access billing history and transaction records.',
      },
      {
        key: 'payments.manage',
        label: 'Manage Payments & Refunds',
        description: 'Create, update, or delete payment records.',
      },
    ],
  },
  {
    id: 'campaigns',
    pageLabel: 'Campaign Leads (Email & WA)',
    href: '/site-admin/campaigns',
    viewPermission: 'campaigns.view',
    description: 'Create and dispatch marketing & trade lead campaigns.',
    permissions: [
      {
        key: 'campaigns.view',
        label: 'View Campaigns',
        description: 'Access campaign history and lead lists.',
      },
      {
        key: 'campaigns.send',
        label: 'Create & Send Campaigns',
        description: 'Dispatch Email and WhatsApp lead campaigns.',
      },
    ],
  },
  {
    id: 'queries',
    pageLabel: 'Customer Queries',
    href: '/site-admin/queries',
    viewPermission: 'queries.view',
    description: 'Review and respond to contact form & support inquiries.',
    permissions: [
      {
        key: 'queries.view',
        label: 'View Customer Queries',
        description: 'Read incoming contact and support tickets.',
      },
      {
        key: 'queries.reply',
        label: 'Reply & Resolve Queries',
        description: 'Send email replies and update query resolution status.',
      },
    ],
  },
  {
    id: 'listings',
    pageLabel: 'Listing Moderation',
    href: '/site-admin/listings',
    viewPermission: 'listings.view',
    description: 'Moderate marketplace stock listings and bulk-upload WTS/WTB sheets.',
    permissions: [
      {
        key: 'listings.view',
        label: 'View All Listings',
        description: 'Inspect published and unpublished marketplace listings.',
      },
      {
        key: 'listings.moderate',
        label: 'Moderate / Remove Listings',
        description: 'Approve, unpublish, or remove non-compliant stock lots.',
      },
      {
        key: 'listings.bulk_upload',
        label: 'Bulk Upload Stock / WTB',
        description: 'Import CSV/Excel batches of WTS or WTB listings.',
      },
    ],
  },
  {
    id: 'messages',
    pageLabel: 'Seller Messaging',
    href: '/site-admin/messages',
    viewPermission: 'messages.view',
    description: 'Direct admin support threads and private seller messaging.',
    permissions: [
      {
        key: 'messages.view',
        label: 'View Seller Threads',
        description: 'Read admin-to-seller inquiry conversations.',
      },
      {
        key: 'messages.send',
        label: 'Send Private Messages',
        description: 'Initiate and reply to private seller messages.',
      },
    ],
  },
  {
    id: 'staff',
    pageLabel: 'Staff & Permissions',
    href: '/site-admin/staff',
    viewPermission: 'staff.view',
    description: 'Invite internal staff members and configure page/feature access.',
    permissions: [
      {
        key: 'staff.view',
        label: 'View Staff Directory',
        description: 'See invited and active staff members and their permissions.',
      },
      {
        key: 'staff.manage',
        label: 'Invite & Manage Staff',
        description: 'Invite new staff, edit permissions, suspend, or remove staff.',
      },
    ],
  },
];

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = ADMIN_PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

/**
 * Checks whether an admin/staff member holds a specific permission.
 */
export function hasAdminPermission(
  role: AdminRole,
  permissions: readonly string[],
  required: AdminPermission
): boolean {
  if (role === 'super_admin') return true;
  return permissions.includes(required);
}

/**
 * Resolves the required view permission for a /site-admin/* pathname.
 * Returns null for /site-admin/profile (always allowed for active admins/staff).
 */
export function getRequiredPermissionForPath(pathname: string): AdminPermission | null {
  if (pathname === '/site-admin/profile' || pathname.startsWith('/site-admin/profile/')) {
    return null;
  }
  if (pathname === '/site-admin') {
    return 'overview.view';
  }
  const match = ADMIN_PERMISSION_GROUPS.find(
    (g) => g.href !== '/site-admin' && (pathname === g.href || pathname.startsWith(`${g.href}/`))
  );
  return match ? match.viewPermission : 'overview.view';
}

/**
 * Returns the first /site-admin route the staff member has permission to view.
 */
export function getFirstPermittedAdminRoute(
  role: AdminRole,
  permissions: readonly string[]
): string {
  if (role === 'super_admin') return '/site-admin';
  for (const group of ADMIN_PERMISSION_GROUPS) {
    if (permissions.includes(group.viewPermission)) {
      return group.href;
    }
  }
  return '/site-admin/profile';
}

export const LISTING_ACTIVE_DURATION_DAYS = 14;
export const LISTING_RECOVERY_WINDOW_DAYS = 30;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MS_PER_HOUR = 60 * 60 * 1000;

export interface LifecycleListingItem {
  id: string;
  title: string;
  brand?: string;
  itemCode?: string;
  condition?: string;
  description: string;
  ean: string;
  category: string;
  unitPrice: number;
  available: number;
  moq: number;
  location?: string;
  status: 'Hot' | 'Active' | 'Draft' | 'Unpublished';
  images?: string[];
  createdAt?: string;
  activatedAt?: string;
  publishedAt?: string;
  expiresAt?: string;
  unpublishedAt?: string;
  unpublishNotificationSent?: boolean;
}

/**
 * Calculates remaining active time and expiration for an active listing.
 * Active listings have a 14-day duration before being automatically unpublished.
 */
export function getListingActiveExpiry(item: {
  activatedAt?: string;
  publishedAt?: string;
  createdAt?: string;
  created_at?: string;
}) {
  const startStr = item.activatedAt || item.publishedAt || item.createdAt || item.created_at;
  const startTime = startStr ? new Date(startStr).getTime() : Date.now();
  const totalDuration = LISTING_ACTIVE_DURATION_DAYS * MS_PER_DAY;
  const expiresAt = new Date(startTime + totalDuration);
  const now = Date.now();
  const remainingMs = Math.max(0, expiresAt.getTime() - now);
  const remainingDays = Math.floor(remainingMs / MS_PER_DAY);
  const remainingHours = Math.floor((remainingMs % MS_PER_DAY) / MS_PER_HOUR);
  const isExpired = remainingMs <= 0;
  const elapsedMs = Math.min(totalDuration, Math.max(0, now - startTime));
  const progressPercent = Math.min(100, Math.round((elapsedMs / totalDuration) * 100));

  return {
    startTime: new Date(startTime),
    expiresAt,
    remainingMs,
    remainingDays,
    remainingHours,
    isExpired,
    progressPercent,
  };
}

/**
 * Calculates remaining recovery time and permanent deletion date for an unpublished listing.
 * Unpublished listings have 30 days to be recovered before permanent deletion.
 */
export function getListingRecoveryExpiry(item: {
  unpublishedAt?: string;
  updatedAt?: string;
  updated_at?: string;
}) {
  const unpublishStr = item.unpublishedAt || item.updatedAt || item.updated_at;
  const unpublishTime = unpublishStr ? new Date(unpublishStr).getTime() : Date.now();
  const totalDuration = LISTING_RECOVERY_WINDOW_DAYS * MS_PER_DAY;
  const permanentDeleteAt = new Date(unpublishTime + totalDuration);
  const now = Date.now();
  const remainingMs = Math.max(0, permanentDeleteAt.getTime() - now);
  const remainingDays = Math.floor(remainingMs / MS_PER_DAY);
  const remainingHours = Math.floor((remainingMs % MS_PER_DAY) / MS_PER_HOUR);
  const isPermanentlyExpired = remainingMs <= 0;
  const elapsedMs = Math.min(totalDuration, Math.max(0, now - unpublishTime));
  const progressPercent = Math.min(100, Math.round((elapsedMs / totalDuration) * 100));

  return {
    unpublishedAt: new Date(unpublishTime),
    permanentDeleteAt,
    remainingMs,
    remainingDays,
    remainingHours,
    isPermanentlyExpired,
    progressPercent,
  };
}

/**
 * Runs the automatic lifecycle processor on an array of listings:
 * 1. Listings older than 14 days in Active/Hot status are moved to Unpublished.
 * 2. Unpublished listings older than 30 days in Unpublished status are permanently deleted.
 */
export function processListingsLifecycle<T extends LifecycleListingItem>(
  listings: T[],
  currentTime: number = Date.now()
): {
  updatedListings: T[];
  newlyUnpublished: T[];
  permanentlyDeletedCount: number;
  hasChanges: boolean;
} {
  const updatedListings: T[] = [];
  const newlyUnpublished: T[] = [];
  let permanentlyDeletedCount = 0;
  let hasChanges = false;

  for (const item of listings) {
    // If Draft, keep as-is
    if (item.status === 'Draft') {
      updatedListings.push(item);
      continue;
    }

    if (item.status === 'Unpublished') {
      // Check 30-day recovery window
      const unpublishStr = item.unpublishedAt;
      const unpublishTime = unpublishStr ? new Date(unpublishStr).getTime() : currentTime;
      const msSinceUnpublish = currentTime - unpublishTime;

      if (msSinceUnpublish >= LISTING_RECOVERY_WINDOW_DAYS * MS_PER_DAY) {
        // 30 days exceeded: Permanently deleted!
        permanentlyDeletedCount++;
        hasChanges = true;
        continue;
      }

      // Still in 30-day recovery window: preserve
      updatedListings.push(item);
      continue;
    }

    // Otherwise, item is 'Active' or 'Hot'
    const startStr = item.activatedAt || item.publishedAt || item.createdAt;
    if (!startStr) {
      // Brand new item without timestamps: stamp current time
      const stampedItem: T = {
        ...item,
        createdAt: new Date(currentTime).toISOString(),
        activatedAt: new Date(currentTime).toISOString(),
        expiresAt: new Date(currentTime + LISTING_ACTIVE_DURATION_DAYS * MS_PER_DAY).toISOString(),
      };
      updatedListings.push(stampedItem);
      hasChanges = true;
      continue;
    }

    const startTime = new Date(startStr).getTime();
    const msSinceStart = currentTime - startTime;

    if (msSinceStart >= LISTING_ACTIVE_DURATION_DAYS * MS_PER_DAY) {
      // 14 days exceeded: Automatically unpublish!
      const unpublishedItem: T = {
        ...item,
        status: 'Unpublished' as const,
        unpublishedAt: new Date(currentTime).toISOString(),
        unpublishNotificationSent: Boolean(item.unpublishNotificationSent),
      };
      updatedListings.push(unpublishedItem);
      newlyUnpublished.push(unpublishedItem);
      hasChanges = true;
    } else {
      // Still active
      updatedListings.push(item);
    }
  }

  return {
    updatedListings,
    newlyUnpublished,
    permanentlyDeletedCount,
    hasChanges,
  };
}

/**
 * Republishes selected listings, resetting their 14-day active timer.
 */
export function republishListingItems<T extends LifecycleListingItem>(
  listings: T[],
  idsToRepublish: string[],
  currentTime: number = Date.now()
): { updatedListings: T[]; republishedCount: number } {
  const idsSet = new Set(idsToRepublish);
  let republishedCount = 0;

  const updatedListings = listings.map((item) => {
    if (idsSet.has(item.id)) {
      republishedCount++;
      return {
        ...item,
        status: 'Active' as const,
        activatedAt: new Date(currentTime).toISOString(),
        publishedAt: new Date(currentTime).toISOString(),
        expiresAt: new Date(currentTime + LISTING_ACTIVE_DURATION_DAYS * MS_PER_DAY).toISOString(),
        unpublishedAt: undefined,
        unpublishNotificationSent: false,
      };
    }
    return item;
  });

  return { updatedListings, republishedCount };
}

/**
 * Permanently deletes selected listings immediately.
 */
export function permanentlyDeleteListingItems<T extends LifecycleListingItem>(
  listings: T[],
  idsToDelete: string[]
): { updatedListings: T[]; deletedCount: number } {
  const idsSet = new Set(idsToDelete);
  let deletedCount = 0;

  const updatedListings = listings.filter((item) => {
    if (idsSet.has(item.id)) {
      deletedCount++;
      return false;
    }
    return true;
  });

  return { updatedListings, deletedCount };
}

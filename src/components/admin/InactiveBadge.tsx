'use client';

import React, { useState, useEffect } from 'react';

interface InactiveBadgeProps {
  lastActiveAt?: string | null;
  lastActive?: string | null;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function InactiveBadge({ lastActiveAt, lastActive }: InactiveBadgeProps) {
  const [isInactive, setIsInactive] = useState(false);

  useEffect(() => {
    if (lastActive?.includes('mo ago')) {
      setIsInactive(true);
      return;
    }
    if (lastActiveAt) {
      const diff = Date.now() - new Date(lastActiveAt).getTime();
      if (diff >= THIRTY_DAYS_MS) {
        setIsInactive(true);
      }
    }
  }, [lastActiveAt, lastActive]);

  if (!isInactive) return null;

  return (
    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
      30d+ Inactive
    </span>
  );
}

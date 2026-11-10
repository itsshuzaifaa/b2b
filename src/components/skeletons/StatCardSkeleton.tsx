import React from 'react';
import { Skeleton } from './Skeleton';

interface StatCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton for dashboard metric stat cards.
 * Matches exact geometry, paddings, and typography heights of live cards to eliminate layout shift.
 */
export function StatCardSkeleton({ className = '' }: StatCardSkeletonProps) {
  return (
    <div
      className={`bg-[#F8FAFC] rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between min-h-[162px] ${className}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-[#EAEFF6] flex items-center justify-between">
        <Skeleton className="h-3.5 w-32 rounded-md" />
        <Skeleton className="h-3.5 w-16 rounded-md" />
      </div>
    </div>
  );
}

export function StatCardsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-6">
      {Array.from({ length: count }).map((_, idx) => (
        <StatCardSkeleton key={idx} />
      ))}
    </div>
  );
}

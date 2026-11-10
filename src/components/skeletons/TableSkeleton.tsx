import React from 'react';
import { Skeleton } from './Skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  variant?: 'table' | 'feed' | 'demand';
}

/**
 * Skeleton variant for tables and feed lists.
 * Provides exact dimensional replicas of tabular data and trade message lists.
 */
export function TableSkeleton({
  rows = 4,
  columns = 4,
  className = '',
  variant = 'feed',
}: TableSkeletonProps) {
  if (variant === 'feed') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="p-3.5 rounded-2xl bg-white border border-[#EAEFF6] flex items-center justify-between gap-3 min-h-[64px]"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-56 rounded-md" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'demand') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="p-3.5 rounded-2xl bg-white border border-[#EAEFF6] flex flex-col justify-between gap-2.5 min-h-[96px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-44 rounded-md" />
                <Skeleton className="h-3.5 w-32 rounded-md" />
              </div>
              <Skeleton className="h-4 w-12 rounded" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Generic data table variant
  return (
    <div
      className={`bg-white rounded-2xl border border-[#EAEFF6] overflow-hidden ${className}`}
    >
      {/* Table Header */}
      <div className="px-6 py-4 bg-[#F8FAFC] border-b border-[#EAEFF6] flex items-center justify-between gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-4 rounded-md ${i === 0 ? 'w-32' : 'w-20'}`}
          />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-[#F1F5F9]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="px-6 py-4 flex items-center justify-between gap-4 min-h-[58px]"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={`h-4 rounded-md ${
                  colIndex === 0 ? 'w-40' : colIndex === columns - 1 ? 'w-16' : 'w-24'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

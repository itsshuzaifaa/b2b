import React from 'react';
import { Skeleton } from './Skeleton';

interface ChartSkeletonProps {
  className?: string;
  title?: boolean;
}

/**
 * Skeleton variant for analytics charts, market volume, and visual data widgets.
 * Matches container borders, paddings, and header/body aspect ratio to prevent CLS.
 */
export function ChartSkeleton({ className = '', title = true }: ChartSkeletonProps) {
  return (
    <div
      className={`bg-[#F8FAFC] rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between ${className}`}
    >
      {title && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEFF6]">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-xl" />
          </div>
        </div>
      )}

      {/* Chart Bars Representation */}
      <div className="h-48 w-full flex items-end gap-2.5 sm:gap-4 pt-6 px-2">
        {[42, 68, 35, 88, 54, 92, 48, 76, 82, 60, 95, 52].map((height, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton
              className="w-full rounded-t-md"
              style={{ height: `${height}%` }}
            />
            <Skeleton className="h-2.5 w-full rounded" />
          </div>
        ))}
      </div>

      {/* Legend & Summary Row */}
      <div className="mt-5 pt-4 border-t border-[#EAEFF6] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-28 rounded-md" />
        </div>
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
    </div>
  );
}

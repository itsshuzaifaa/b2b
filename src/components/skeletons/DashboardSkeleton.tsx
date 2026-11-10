import React from 'react';
import { Skeleton } from './Skeleton';
import { StatCardsGridSkeleton } from './StatCardSkeleton';
import { TableSkeleton } from './TableSkeleton';

/**
 * Full page skeleton representing the entire Trading Overview dashboard.
 * Used for App Router loading.tsx and initial unhydrated states.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Loading dashboard">
      {/* Top Banner / Greeting Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-52 rounded-lg" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-80 sm:w-96 rounded-md" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <Skeleton className="h-10 w-44 rounded-full" />
          <Skeleton className="h-10 w-44 rounded-full" />
        </div>
      </div>

      {/* 4 Metric Cards Skeleton */}
      <StatCardsGridSkeleton count={4} />

      {/* Trading Matches Widget Skeleton */}
      <div className="bg-[#F8FAFC] rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEFF6]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-72 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-36 rounded-full" />
            <Skeleton className="h-8 w-44 rounded-xl" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-white border border-[#EAEFF6] space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-3 w-28 rounded-md" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#EAEFF6]">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Two-Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-7">
        {/* LEFT COLUMN: Active Inquiries (7 Cols) */}
        <div className="lg:col-span-7 bg-[#F8FAFC] rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="space-y-1">
                <Skeleton className="h-5 w-52 rounded-md" />
                <Skeleton className="h-3.5 w-64 rounded-md" />
              </div>
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <TableSkeleton rows={4} variant="feed" />
          </div>
        </div>

        {/* RIGHT COLUMN: Want-To-Buy Demand (5 Cols) */}
        <div className="lg:col-span-5 bg-[#F8FAFC] rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="space-y-1">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3.5 w-56 rounded-md" />
              </div>
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <TableSkeleton rows={3} variant="demand" />
          </div>
          <div className="mt-4 pt-3 border-t border-[#EAEFF6] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

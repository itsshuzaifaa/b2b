import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  rounded?: string;
}

/**
 * Reusable Skeleton loading block with smooth left-to-right shimmer keyframe animation,
 * dark-mode theme color compatibility, and prefers-reduced-motion accommodation.
 */
export function Skeleton({
  className = '',
  rounded = 'rounded-xl',
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-[#E2E8F0] ${rounded} ${className}`}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/85 to-transparent motion-reduce:hidden pointer-events-none" />
    </div>
  );
}

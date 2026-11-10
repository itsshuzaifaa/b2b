'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="py-16 flex items-center justify-center px-4 animate-fade-in">
      <div className="max-w-md w-full bg-white border border-[#EAEFF6] rounded-3xl p-6 sm:p-8 text-center shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-[#0B1F3A]">
          Unable to Load Trading Workspace
        </h2>
        <p className="text-sm text-[#5B6B82] mt-2 mb-6">
          An unexpected issue prevented this view from loading completely. Please try refreshing or retrying below.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-sm px-6 py-3 rounded-full transition shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading Dashboard</span>
        </button>
      </div>
    </div>
  );
}

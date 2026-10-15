'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/site-admin');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Redirecting to Admin Portal...</p>
      </div>
    </div>
  );
}

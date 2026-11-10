'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function MessagesRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const target = params ? `/dashboard/inquiries?${params}` : '/dashboard/inquiries';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="w-8 h-8 text-[#0A6CFF] animate-spin" />
      <p className="text-[14px] font-medium text-[#5B6B82]">Loading Messaging Center...</p>
    </div>
  );
}

export default function MessagesRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 text-[#0A6CFF] animate-spin" />
          <p className="text-[14px] font-medium text-[#5B6B82]">Loading Messaging Center...</p>
        </div>
      }
    >
      <MessagesRedirectContent />
    </Suspense>
  );
}

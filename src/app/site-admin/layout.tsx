import React, { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { SiteAdminClientShell } from './SiteAdminClientShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';

export const instant = false;

export default async function SiteAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const auth = await requireAdmin();

  // 1. Not logged in -> Server-side redirect to /login with redirect query param
  if (!auth.user) {
    redirect('/login?redirect=/site-admin');
  }

  // 2. Logged-in non-admin -> Server-rendered 403 Forbidden Page
  if (!auth.isAdmin) {
    return (
      <div className="min-h-screen bg-[#050E1D] text-white flex flex-col justify-center items-center p-6 text-center font-sans relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#0B1A30] border border-red-500/20 rounded-[28px] p-8 shadow-2xl relative z-10 backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5 text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <span className="bg-red-500/20 text-red-300 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border border-red-500/30 tracking-wider">
            403 ACCESS DENIED
          </span>

          <h1 className="text-[22px] font-black text-white mt-3 tracking-tight">
            Administrator Access Required
          </h1>

          <p className="text-[13px] text-slate-300 mt-2 leading-relaxed">
            Your account (<strong className="text-white">{auth.user.email}</strong>) does not have verified administrative privileges to access the B2B LINK Executive Desk.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/dashboard"
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] text-center transition shadow-md shadow-[#0A6CFF]/20"
            >
              Member Dashboard
            </Link>

            <Link
              href="/login"
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white font-bold text-[13px] text-center transition border border-white/10"
            >
              Switch Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin -> Render Interactive Site Admin Shell
  return (
    <SiteAdminClientShell userEmail={auth.user.email || 'admin@b2blink.eu'}>
      <Suspense fallback={<TableSkeleton rows={8} variant="table" />}>
        {children}
      </Suspense>
    </SiteAdminClientShell>
  );
}

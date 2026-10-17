import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Manrope } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { LiveMessageToast } from '@/components/messaging/LiveMessageToast';
import { CookieConsentBanner } from '@/components/cookies/CookieConsentBanner';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'B2B LINK OÜ — European Wholesale Trading & Sourcing Platform',
  description:
    'Europe’s verified wholesale network. Connect direct with European distributors, post sourcing requests, and trade with 0% platform transaction fees.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`h-full antialiased scroll-smooth ${manrope.variable}`}
    >
      <body className="min-h-full flex flex-col bg-[#F3F6FB] text-[#41536D] font-sans">
        <AuthProvider>
          <Suspense fallback={<div className="h-20 bg-white border-b border-slate-200" />}>
            <Navbar />
          </Suspense>
          <main className="flex-1 flex flex-col">{children}</main>
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
          <Suspense fallback={null}>
            <LiveMessageToast />
          </Suspense>
          <Suspense fallback={null}>
            <CookieConsentBanner />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

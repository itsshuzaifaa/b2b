import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Manrope } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { LiveMessageToast } from '@/components/messaging/LiveMessageToast';
import { LiveMessageNotifier } from '@/components/messaging/LiveMessageNotifier';
import { CookieConsentBanner } from '@/components/cookies/CookieConsentBanner';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://b2blink.eu';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'B2B LINK OÜ — Global Wholesale Trading & Sourcing Platform',
    template: '%s | B2B LINK',
  },
  description:
    'The verified global wholesale network. Connect direct with global distributors, post sourcing requests, and trade with 0% platform transaction fees.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: appUrl,
    siteName: 'B2B LINK',
    title: 'B2B LINK OÜ — Global Wholesale Trading & Sourcing Platform',
    description:
      'The verified global wholesale network. Connect direct with global distributors, post sourcing requests, and trade with 0% platform transaction fees.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'B2B LINK Global Wholesale Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'B2B LINK OÜ — Global Wholesale Trading & Sourcing Platform',
    description:
      'The verified global wholesale network. Connect direct with global distributors, post sourcing requests, and trade with 0% platform transaction fees.',
    images: ['/og-image.png'],
  },
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
        <QueryProvider>
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
              <LiveMessageNotifier />
            </Suspense>
            <Suspense fallback={null}>
              <CookieConsentBanner />
            </Suspense>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

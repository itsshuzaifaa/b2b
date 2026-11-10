import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wholesale Stock Lots Marketplace',
  description: 'Browse verified wholesale stock lots, consumer electronics, and surplus inventory direct from European suppliers.',
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}

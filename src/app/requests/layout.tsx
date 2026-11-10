import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wholesale Buy (WTB) Requests',
  description: 'View active commercial buy and sourcing requests from verified wholesale buyers across Europe.',
};

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

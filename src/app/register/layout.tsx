import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply for Membership',
  description: 'Register and apply for membership on B2B LINK, the European wholesale trading network.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

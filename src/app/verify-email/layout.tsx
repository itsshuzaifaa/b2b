import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Verify your business email address on B2B LINK.',
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}

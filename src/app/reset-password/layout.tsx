import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Reset your B2B LINK account access password.',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

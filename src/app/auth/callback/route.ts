import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDynamicAppUrl } from '@/lib/utils/app-url';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') || '/dashboard';

  const appUrl = await getDynamicAppUrl(request);
  const supabase = await createClient();

  if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data?.user?.email) {
        try {
          await fetch(`${appUrl}/api/auth/dispatch-kyc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.user.email }),
          });
        } catch {}
      }
      return NextResponse.redirect(`${appUrl}${next}`);
    }
  }

  if (tokenHash && type) {
    const { error, data } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change',
    });
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${appUrl}/reset-password`);
      }
      if (data?.user?.email) {
        try {
          await fetch(`${appUrl}/api/auth/dispatch-kyc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.user.email }),
          });
        } catch {}
      }
      return NextResponse.redirect(`${appUrl}${next}`);
    }
  }

  // Redirect to dashboard
  return NextResponse.redirect(`${appUrl}${next}`);
}

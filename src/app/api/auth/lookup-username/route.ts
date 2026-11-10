import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = await enforceRateLimit(request, 'lookup-username');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const rawIdentifier = (body.identifier || '').trim();
    const password = (body.password || '').trim();

    // CRITICAL SECURITY MANDATE:
    // lookup-username must NEVER reveal whether a username exists to unauthenticated callers.
    // It requires the account's password to authenticate before resolving username to email.
    // Probing with arbitrary usernames always returns identical 401 'Invalid login credentials.'
    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { error: 'Invalid login credentials.' },
        { status: 401 }
      );
    }

    // 1. If identifier is already an email address
    if (rawIdentifier.includes('@')) {
      const email = rawIdentifier.toLowerCase();
      // Verify credentials with Supabase
      const supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return NextResponse.json({ error: 'Invalid login credentials.' }, { status: 401 });
      }

      return NextResponse.json({ email });
    }

    const usernameToFind = rawIdentifier.toLowerCase();
    const normalizedUsername = usernameToFind.replace(/[^a-z0-9]/g, '');
    const admin = createAdminClient();

    // 2. Lookup candidate company
    const { data: companies, error: compError } = await admin
      .from('companies')
      .select('id, user_id, contact_email, contact_name, company_name');

    let candidateEmail: string | null = null;
    if (!compError && companies && companies.length > 0) {
      const matchedCompany = companies.find((c: any) => {
        if (!c.contact_email) return false;

        const emailLower = (c.contact_email || '').toLowerCase();
        if (emailLower.startsWith(`${usernameToFind}@`) || emailLower === usernameToFind) {
          return true;
        }

        const contactNameLower = (c.contact_name || '').toLowerCase();
        if (
          contactNameLower === usernameToFind ||
          contactNameLower.replace(/\s+/g, '_') === usernameToFind ||
          contactNameLower.replace(/[^a-z0-9]/g, '') === normalizedUsername
        ) {
          return true;
        }

        const compNameLower = (c.company_name || '').toLowerCase();
        if (
          compNameLower === usernameToFind ||
          compNameLower.replace(/\s+/g, '_') === usernameToFind ||
          compNameLower.replace(/[^a-z0-9]/g, '') === normalizedUsername
        ) {
          return true;
        }

        return false;
      });

      if (matchedCompany?.contact_email) {
        candidateEmail = matchedCompany.contact_email.toLowerCase();
      }
    }

    if (!candidateEmail) {
      // Must return identical 401 without revealing whether the username exists
      return NextResponse.json(
        { error: 'Invalid login credentials.' },
        { status: 401 }
      );
    }

    // 3. Verify password for candidate email
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: candidateEmail,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Invalid login credentials.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ email: candidateEmail });
  } catch (err) {
    console.error('[LOOKUP USERNAME EXCEPTION]', err);
    return NextResponse.json(
      { error: 'Invalid login credentials.' },
      { status: 401 }
    );
  }
}

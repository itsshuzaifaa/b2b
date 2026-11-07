import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIdentifier = (body.identifier || '').trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        { error: 'Please enter your username or email address.' },
        { status: 400 }
      );
    }

    // 1. If identifier looks like an email address, return directly
    if (rawIdentifier.includes('@')) {
      return NextResponse.json({ email: rawIdentifier.toLowerCase() });
    }

    const usernameToFind = rawIdentifier.toLowerCase();
    const normalizedUsername = usernameToFind.replace(/[^a-z0-9]/g, '');
    const admin = createAdminClient();

    // 2. Direct lookup in companies table (all registered users have a row here)
    const { data: companies, error: compError } = await admin
      .from('companies')
      .select('id, user_id, contact_email, contact_name, company_name');

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

      if (matchedCompany && matchedCompany.contact_email) {
        return NextResponse.json({ email: matchedCompany.contact_email.toLowerCase() });
      }
    }

    return NextResponse.json(
      { error: `No account found with username "${rawIdentifier}".` },
      { status: 404 }
    );
  } catch (err) {
    console.error('[LOOKUP USERNAME EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during user lookup.' },
      { status: 500 }
    );
  }
}

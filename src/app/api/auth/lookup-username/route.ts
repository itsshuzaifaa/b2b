import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findUserByUsername, findUserByIdentifier } from '@/lib/auth/user-registry';
import { MOCK_COMPANIES } from '@/lib/mock-data';

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

    // If identifier looks like an email address, return directly
    if (rawIdentifier.includes('@')) {
      return NextResponse.json({ email: rawIdentifier.toLowerCase() });
    }

    const usernameToFind = rawIdentifier.toLowerCase();

    // 1. Check server-side user registry first (fastest and handles all signups)
    const registryMatch = findUserByUsername(usernameToFind) || findUserByIdentifier(usernameToFind);
    if (registryMatch?.email) {
      return NextResponse.json({
        email: registryMatch.email,
        username: registryMatch.username,
      });
    }

    // 2. Check Supabase Auth users if available
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        const { data: usersData, error } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (!error && usersData?.users) {
          const matchedUser = usersData.users.find((u: any) => {
            const uMeta = u.user_metadata || {};
            const uName = (uMeta.username as string | undefined)?.toLowerCase()?.trim();
            const uFirst = (uMeta.first_name as string | undefined)?.toLowerCase()?.trim();
            const uLast = (uMeta.last_name as string | undefined)?.toLowerCase()?.trim();
            const uEmailPrefix = (u.email as string | undefined)?.toLowerCase()?.split('@')[0]?.trim();

            return (
              uName === usernameToFind ||
              uEmailPrefix === usernameToFind ||
              (uFirst && uLast && `${uFirst}${uLast}` === usernameToFind)
            );
          });

          if (matchedUser?.email) {
            return NextResponse.json({ email: matchedUser.email });
          }
        }

        // Also check companies table
        const { data: comp } = await admin
          .from('companies')
          .select('contact_email, company_name, contact_name')
          .or(`company_name.ilike.%${usernameToFind}%,contact_name.ilike.%${usernameToFind}%`)
          .maybeSingle();

        if (comp?.contact_email) {
          return NextResponse.json({ email: comp.contact_email });
        }
      } catch (dbErr) {
        console.warn('[LOOKUP USERNAME DB NOTICE]', dbErr);
      }
    }

    // 3. Check mock/demo companies for quick testing
    const demoMatch = MOCK_COMPANIES.find(
      (c) =>
        c.name.toLowerCase().includes(usernameToFind) ||
        c.contact_name.toLowerCase().includes(usernameToFind) ||
        c.email.toLowerCase().startsWith(usernameToFind)
    );

    if (demoMatch?.email) {
      return NextResponse.json({ email: demoMatch.email });
    }

    return NextResponse.json(
      { error: `No account found with username "${rawIdentifier}".` },
      { status: 404 }
    );
  } catch (err: any) {
    console.error('[LOOKUP USERNAME EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during user lookup.' },
      { status: 500 }
    );
  }
}

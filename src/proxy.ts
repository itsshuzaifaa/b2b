import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 Session Refresh & Route Protection Proxy (src/proxy.ts)
 * 
 * Functions:
 * 1. Refreshes active Supabase session tokens via @supabase/ssr using getUser().
 * 2. Second layer of defense for route protection:
 *    - Redirects logged-out visitors away from /dashboard/* to /login?redirect=...
 *    - Redirects non-admin users away from /site-admin/* to /dashboard
 * 3. Excludes static assets and internal Next.js files via matcher.
 * 
 * Note: Authoritative authorization checks remain enforced server-side inside
 * layouts, route handlers, and Server Actions (requireUser, requireAdmin).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Always refresh session via getUser() (never getSession())
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Helper to copy refreshed cookies onto redirect responses
  const createRedirectWithCookies = (url: URL | string) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  };

  // Route protection: redirect logged-out visitors away from protected paths
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/site-admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return createRedirectWithCookies(loginUrl);
    }
  }

  return response;
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

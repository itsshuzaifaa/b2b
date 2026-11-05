/**
 * Utility to verify whether Supabase credentials have been properly configured
 * with real production or staging values rather than placeholder strings.
 */
export function isSupabaseConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

  if (!url || !anonKey) {
    return false;
  }

  // Check URL validity and placeholder markers
  if (
    (!url.startsWith('http://') && !url.startsWith('https://')) ||
    url.includes('your-project') ||
    url.includes('example.com') ||
    url.includes('placeholder') ||
    url.includes('your-supabase')
  ) {
    return false;
  }

  // Check anon key placeholder markers
  if (
    anonKey.includes('your-supabase') ||
    anonKey.includes('placeholder') ||
    anonKey.includes('your-anon-key')
  ) {
    return false;
  }

  // Check service role key placeholder markers if present on server
  if (typeof window === 'undefined') {
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)?.trim();
    if (
      serviceKey &&
      (serviceKey.includes('your-supabase') ||
        serviceKey.includes('placeholder') ||
        serviceKey.includes('your-service-role'))
    ) {
      return false;
    }
  }

  return true;
}

'use client';

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-not-configured';

/**
 * Browser Supabase client. Uses the public anon key — every query is still
 * filtered by Row Level Security, so this is safe to ship to the client.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let singleton: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  if (!singleton) singleton = createClient();
  return singleton;
}

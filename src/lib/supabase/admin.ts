import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client.
 *
 * RLS is on for every `sq_*` table with no anon or authenticated policies, so
 * the publishable key grants nothing and is deliberately never used here. The
 * browser never reaches Postgres — reads and writes go through route handlers
 * and server components, which hold the secret key and bypass RLS.
 */
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    // Thrown rather than returned so `getRepository()` catches it and falls
    // back to the in-memory store instead of rendering a half-dead page.
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.',
    );
  }

  // No session to persist — every call is a short-lived server request.
  client = createClient(url, secret, { auth: { persistSession: false } });
  return client;
}

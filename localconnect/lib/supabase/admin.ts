import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client using the service role key. NEVER import this from a
 * client component — it bypasses Row Level Security entirely. Only used by
 * the push-notification API route to look up another user's subscriptions.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

// Server-side client using the service-role key: this is a single-user app
// with no RLS-driven multi-tenancy, so every mutation goes through Server
// Actions/route handlers, never a browser-held service key.
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseServer() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).",
    );
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}

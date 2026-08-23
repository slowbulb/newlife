"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

// Anon-key client for the browser — used only for realtime subscriptions
// (e.g. watching the gutter fill as classification finishes). All writes go
// through Server Actions, never straight from the client.
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseBrowser() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  cached = createClient<Database>(url, key, { auth: { persistSession: false } });
  return cached;
}

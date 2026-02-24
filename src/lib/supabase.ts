import { createClient } from "@supabase/supabase-js";

import { optionalEnv } from "@/server/env";

export function getSupabaseBrowserClient() {
  const url = optionalEnv("SUPABASE_URL");
  const anonKey = optionalEnv("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return null;
  }
  return createClient(url, anonKey);
}

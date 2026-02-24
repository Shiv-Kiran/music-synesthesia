import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "@/server/env";

export function getSupabaseAdminClient() {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

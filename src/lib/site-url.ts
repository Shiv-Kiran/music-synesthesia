import { optionalEnv } from "@/server/env";

export function getSiteUrl(): string {
  const fromEnv = optionalEnv("NEXT_PUBLIC_SITE_URL");
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

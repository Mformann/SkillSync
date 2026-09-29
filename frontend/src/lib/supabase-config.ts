export function supabaseConfigurationError(url: string, key: string): string | null {
  if (!url || !key) return "Set VITE_SUPABASE_URL and a public VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).";
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" || (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) {
      return "VITE_SUPABASE_URL must be your project's HTTPS origin (HTTP is allowed only for local development).";
    }
  } catch { return "VITE_SUPABASE_URL is not a valid project URL."; }
  if (key.startsWith("sb_publishable_")) return null;
  // Inspect legacy key metadata only to prevent accidentally publishing a
  // secret/service-role key. This is configuration validation, not JWT auth.
  try {
    const encoded = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded));
    if (payload.role === "anon") return null;
  } catch { /* Invalid and secret keys must not be bundled. */ }
  return "Use a public Supabase publishable/anon key. Secret and service-role keys must never be bundled in the frontend.";
}

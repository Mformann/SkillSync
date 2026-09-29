const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function apiBaseUrlConfigurationError(value: string): string | null {
  if (!value.trim()) return "Set VITE_API_BASE_URL to the deployed SkillSync API origin.";
  try {
    const parsed = new URL(value);
    const local = LOCAL_HOSTS.has(parsed.hostname);
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/" ||
      (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
    ) {
      return "VITE_API_BASE_URL must be an HTTPS origin (HTTP is allowed only for local development).";
    }
  } catch {
    return "VITE_API_BASE_URL is not a valid API origin.";
  }
  return null;
}

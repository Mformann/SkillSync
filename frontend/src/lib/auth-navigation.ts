export function postLoginPath(state: unknown): string {
  const from = state && typeof state === "object" && "from" in state ? state.from : null;
  if (
    typeof from !== "string" || !from.startsWith("/") || from.startsWith("//") ||
    from.includes("\\") || Array.from(from).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    ["/login", "/signup", "/forgot-password", "/reset-password"].includes(from.split(/[?#]/)[0])
  ) return "/dashboard";
  return from;
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return "Please confirm your email using the link in your inbox, then try again.";
    }
    return error.message || fallback;
  }
  return fallback;
}

import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth-provider";

const linkClass = "rounded-sm font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LegalNotice({ action }: { action: "signing up" | "logging in" }) {
  return <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">
    By {action}, you agree to our <Link to="/terms" className={linkClass}>Terms &amp; conditions</Link> and acknowledge our <Link to="/privacy-policy" className={linkClass}>Privacy policy</Link>.
  </p>;
}

export function LegalFooter() {
  const { pathname } = useLocation();
  const { session } = useAuth();
  // These pages already show their own legal links.
  if (["/", "/login", "/signup"].includes(pathname)) return null;
  return <footer className="border-t border-border bg-card">
    <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
      <p className="text-muted-foreground">SkillSync · Operated by Akyra Studios</p>
      <nav aria-label="Legal and support" className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Link to="/privacy-policy" className={`${linkClass} inline-flex min-h-11 items-center`}>Privacy policy</Link>
        <Link to="/terms" className={`${linkClass} inline-flex min-h-11 items-center`}>Terms &amp; conditions</Link>
        {session && <Link to="/privacy" className={`${linkClass} inline-flex min-h-11 items-center`}>Data controls</Link>}
        <a href="mailto:mann@akyrastudios.com" className={`${linkClass} inline-flex min-h-11 items-center`}>Contact Akyra Studios</a>
      </nav>
    </div>
  </footer>;
}

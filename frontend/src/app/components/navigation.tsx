import { Link, useLocation, useNavigate } from "react-router-dom";
import { Moon, Sun, LayoutDashboard, BriefcaseBusiness, TrendingUp, BookOpen, Compass, Menu, X, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth-provider";
import { supabase } from "../../lib/supabase";
import { CareerReminderBell } from "./career-reminder-bell";

// Reusable NavLink Component
function NavLink({ to, label, icon: Icon, isActive }: { to: string; label: string; icon: any; isActive: boolean }) {
  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={`relative isolate inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "text-foreground" : "text-muted-foreground"}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      {isActive && (
        <motion.div
          layoutId="activeNav"
          className="absolute inset-0 rounded-lg bg-secondary"
          style={{ zIndex: -1 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </Link>
  );
}

// Theme Toggle Component
function ThemeToggle({ theme, toggleTheme }: { theme: string | undefined; toggleTheme: () => void }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="flex size-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={theme}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}

export function Navigation() {
  const { session } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const logout = async () => {
    setLogoutBusy(true);
    setLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("We couldn't sign you out. Check your connection and try again.");
    } finally { setLogoutBusy(false); }
  };

  const isLoggedIn = Boolean(session);

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/workspaces", label: "Target Jobs", icon: BriefcaseBusiness },
    { to: "/analysis", label: "Analysis", icon: TrendingUp },
    { to: "/roadmap", label: "Roadmap", icon: BookOpen },
    { to: "/career", label: "Career Hub", icon: Compass },
  ];

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to={isLoggedIn ? "/dashboard" : "/"}
            aria-label="SkillSync home"
            className="flex min-h-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <motion.img
              src="/brand/skillsync-lockup-tagline.png"
              alt=""
              width={2172}
              height={724}
              className="h-10 w-auto max-w-[126px] object-contain dark:invert dark:hue-rotate-180 sm:h-11 sm:max-w-[138px]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            />
          </Link>

          {/* Desktop Navigation */}
          {!isLoggedIn && location.pathname === "/" && (
            <div className="hidden items-center gap-1 lg:flex">
              {[
                ["#features", "Product"],
                ["#how-it-works", "How it works"],
                ["#privacy", "Privacy"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {label}
                </a>
              ))}
            </div>
          )}

          {isLoggedIn && (
            <div className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  label={link.label}
                  icon={link.icon}
                  isActive={location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)}
                />
              ))}
            </div>
          )}

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {isLoggedIn && !location.pathname.startsWith("/passport/") && <CareerReminderBell />}
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

            {!isLoggedIn && location.pathname === "/" && (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="hidden min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 sm:px-4"
                >
                  Sign up
                </Link>
              </div>
            )}

            {isLoggedIn && (
              <button
                type="button"
                onClick={logout}
                disabled={logoutBusy}
                className="hidden min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:inline-flex"
                title="Sign out"
              >
                <LogOut className="size-3.5" />
                <span>Log out</span>
              </button>
            )}

            {/* Mobile menu button */}
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex size-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
              >
                {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {logoutError && <p role="alert" className="border-t border-destructive/30 px-4 py-3 text-sm text-destructive">{logoutError}</p>}

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isLoggedIn && mobileMenuOpen && (
          <motion.div
            id="mobile-navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border bg-card lg:hidden"
          >
            <div className="space-y-1 px-4 py-3 [&_a]:flex [&_a]:w-full">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  label={link.label}
                  icon={link.icon}
                  isActive={location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)}
                />
              ))}
              <button
                type="button"
                onClick={logout}
                disabled={logoutBusy}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-destructive hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <LogOut className="size-4" />
                <span>Log out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

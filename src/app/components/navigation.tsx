import { Link, useLocation } from "react-router-dom";
import { Moon, Sun, LayoutDashboard, Upload, TrendingUp, BookOpen, BarChart3, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

// Reusable NavLink Component
function NavLink({ to, label, icon: Icon, isActive }: { to: string; label: string; icon: any; isActive: boolean }) {
  return (
    <Link
      to={to}
      className={`relative px-4 py-2 text-sm transition-colors hover:text-foreground ${isActive ? "text-foreground" : "text-muted-foreground"}`}
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
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Toggle theme"
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
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoggedIn = !["/", "/login", "/signup"].includes(location.pathname);

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/upload", label: "Upload", icon: Upload },
    { to: "/analysis", label: "Analysis", icon: TrendingUp },
    { to: "/gap-report", label: "Gap Report", icon: BarChart3 },
    { to: "/roadmap", label: "Roadmap", icon: BookOpen },
  ];

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
            <motion.div
              className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <TrendingUp className="size-5 text-primary-foreground" />
            </motion.div>
            <span className="text-xl tracking-tight">SkillSync</span>
          </Link>

          {/* Desktop Navigation */}
          {isLoggedIn && (
            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  label={link.label}
                  icon={link.icon}
                  isActive={location.pathname === link.to}
                />
              ))}
            </div>
          )}

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

            {!isLoggedIn && location.pathname === "/" && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Log in
                </Link>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/signup"
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                  >
                    Sign up
                  </Link>
                </motion.div>
              </div>
            )}

            {/* Mobile menu button */}
            {isLoggedIn && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isLoggedIn && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border bg-card md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  label={link.label}
                  icon={link.icon}
                  isActive={location.pathname === link.to}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth-provider";
import { PasswordInput } from "./password-input";
import { AuthFeedback } from "./auth-feedback";
import { authErrorMessage, postLoginPath } from "../../lib/auth-navigation";

export function LoginPage() {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, error: sessionError, passwordRecovery } = useAuth();
  const destination = postLoginPath(location.state);

  useEffect(() => {
    if (!loading && session) {
      navigate(passwordRecovery ? "/reset-password" : destination, { replace: true });
    }
  }, [session, loading, passwordRecovery, destination, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // New state for API handling
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Send credentials to Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;
      if (!data.session) throw new Error("Sign-in did not create a session. Please try again.");

      // Supabase securely persists the session for the application.
      // Do not navigate here, the useEffect will handle it once the session updates globally.

    } catch (err: unknown) {
      setError(authErrorMessage(err, "We couldn't sign you in. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-12">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Log in to your SkillSync account</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          
          <AuthFeedback message={error || sessionError} error />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-input-background py-3 pl-11 pr-4 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-sm">
                  Password
                </label>
                <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput id="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                   <Loader2 className="size-4 animate-spin" />
                   Logging in...
                </>
              ) : (
                <>
                   Log in
                   <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          By logging in, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
}

import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { authErrorMessage } from "../../lib/auth-navigation";
import { useAuth } from "../auth-provider";
import { AuthFeedback } from "./auth-feedback";
import { PasswordInput } from "./password-input";

const buttonClass = "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60";

function RecoveryShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10"><div className="w-full max-w-md"><header className="mb-8 text-center"><h1 className="mb-2 text-3xl tracking-tight">{title}</h1><p className="text-muted-foreground">{description}</p></header><section className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">{children}</section><Link className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/login"><ArrowLeft aria-hidden="true" className="size-4" /> Back to sign in</Link></div></main>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (resetError) throw resetError;
      setSent(true);
    } catch (cause) {
      setError(authErrorMessage(cause, "We couldn't send the reset link. Please try again."));
    } finally { setBusy(false); }
  }
  return <RecoveryShell title="Forgot your password?" description="We'll send a secure link to reset it."><AuthFeedback message={error} error />{sent ? <><AuthFeedback message="If an account exists for that email, a reset link has been sent. Check your inbox and spam folder." /><button type="button" className="min-h-11 text-sm text-primary hover:underline" onClick={() => setSent(false)}>Use another email</button></> : <form onSubmit={submit} className="space-y-5"><div><label htmlFor="recovery-email" className="mb-2 block text-sm">Email</label><input id="recovery-email" name="email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-input-background px-3 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" /></div><button type="submit" disabled={busy} className={buttonClass}>{busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}{busy ? "Sending link…" : "Send reset link"}</button></form>}</RecoveryShell>;
}

export function ResetPasswordPage() {
  const { session, loading, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    if (password !== confirmation) { setError("Your passwords don't match. Please enter them again."); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmation("");
      setComplete(true);
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
        if (signOutError) throw signOutError;
      } catch {
        setError("Your password was updated, but sign-out could not be completed. Please log out before signing in again.");
      } finally { clearPasswordRecovery(); }
    } catch (cause) {
      setError(authErrorMessage(cause, "We couldn't update your password. Request a new reset link and try again."));
    } finally { setBusy(false); }
  }
  return <RecoveryShell title="Set a new password" description="Choose a strong password you haven't used before."><AuthFeedback message={error} error />{loading ? <p role="status">Checking your reset link…</p> : complete ? <AuthFeedback message="Your password has been updated. Sign in again with your new password." /> : !session ? <><p role="alert" className="mb-5 text-destructive">This reset link is missing or has expired. Request a new link to continue.</p><Link to="/forgot-password" className={buttonClass}>Request a new reset link</Link></> : <form onSubmit={submit} className="space-y-5"><div><label htmlFor="new-password" className="mb-2 block text-sm">New password</label><PasswordInput id="new-password" name="password" autoComplete="new-password" minLength={8} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} aria-describedby="reset-password-help" /><p id="reset-password-help" className="mt-2 text-xs text-muted-foreground">Use at least 8 characters.</p></div><div><label htmlFor="confirm-password" className="mb-2 block text-sm">Confirm new password</label><PasswordInput id="confirm-password" name="confirmation" autoComplete="new-password" minLength={8} required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div><button type="submit" disabled={busy} className={buttonClass}>{busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}{busy ? "Updating password…" : "Update password"}</button></form>}</RecoveryShell>;
}

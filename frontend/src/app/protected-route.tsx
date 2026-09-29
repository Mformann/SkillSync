import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-provider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, error, passwordRecovery } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center" role="status">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }
  if (error && !session) {
    return <main className="mx-auto max-w-md px-4 py-12"><p role="alert" className="mb-5 text-destructive">{error}</p><Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-primary-foreground" to="/login">Sign in again</Link></main>;
  }
  if (passwordRecovery) return <Navigate to="/reset-password" replace />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }
  return children;
}

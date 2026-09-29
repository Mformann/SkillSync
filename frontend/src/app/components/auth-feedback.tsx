import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function AuthFeedback({ message, error = false }: { message: string; error?: boolean }) {
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message && error) feedback.current?.focus(); }, [message, error]);
  if (!message) return null;
  return (
    <div ref={feedback} tabIndex={error ? -1 : undefined} role={error ? "alert" : "status"} className={`mb-5 flex items-start gap-2 rounded-lg border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-foreground"}`}>
      {error ? <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import axios from "axios";
import { api } from "../../lib/api";
import { growthError } from "../../lib/growth";

export const growthField = "mt-2 min-h-11 w-full rounded-lg border border-border bg-input-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const growthButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
export const growthSecondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function useGrowthResource<T>(url: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(url));
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError("");
    setLoading(Boolean(url));
    if (!url) return () => controller.abort();
    api.get<T>(url, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setData(response.data);
    }).catch(error => {
      if (!controller.signal.aborted && !axios.isCancel(error)) setError(growthError(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, version]);
  return { data, error, loading, reload };
}

export function useGrowthAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (error) { setError(growthError(error)); }
    finally { setBusy(false); }
  }
  return { busy, error, message, setMessage, run };
}

export function GrowthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="text-xl font-medium">{title}</h2>{description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}<div className="mt-5">{children}</div></section>;
}

export function GrowthFeedback({ busy, error, message }: { busy?: boolean; error?: string; message?: string }) {
  return <>{busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Working…</p>}{error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{message && <p role="status" className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm">{message}</p>}</>;
}

export function ResourceFeedback({ resource }: { resource: { loading: boolean; error: string; reload: () => void } }) {
  return <><GrowthFeedback busy={resource.loading} error={resource.error} />{resource.error && <button type="button" className={`${growthSecondary} mt-3`} onClick={resource.reload}>Try again</button>}</>;
}

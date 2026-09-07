import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clipboard, Loader2, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";

type Package = { id: number; content: Record<"cover_letter" | "recruiter_outreach" | "follow_up", string>; source_map: Record<string, { type: string; quote: string; source_note?: string }>; warnings: { severity: string; message: string }[] };
const labels = { cover_letter: "Cover letter", recruiter_outreach: "Recruiter outreach", follow_up: "Follow-up message" };

export function ApplicationPackagePage() {
  const { id } = useParams();
  const [item, setItem] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const create = async () => {
    setBusy("generate");
    const response = await api.post<Package>(`/product/workspaces/${id}/package`);
    setItem(response.data); setBusy("");
  };
  useEffect(() => {
    api.get<Package>(`/product/workspaces/${id}/package`).then((response) => setItem(response.data)).catch(() => create()).finally(() => setLoading(false));
  }, [id]);
  const save = async () => {
    if (!item) return;
    setBusy("save");
    const response = await api.patch<Package>(`/product/packages/${item.id}`, { content: item.content });
    setItem(response.data); setBusy("");
  };
  const copy = async (key: keyof Package["content"]) => {
    if (!item) return;
    await navigator.clipboard.writeText(item.content[key]); setCopied(key); setTimeout(() => setCopied(""), 1800);
  };
  if (loading || !item) return <main className="flex min-h-[70vh] items-center justify-center" role="status"><Loader2 className="size-7 animate-spin text-primary" /></main>;
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Link to="/career" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Career Hub</Link><header className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-medium text-primary">Evidence-first application materials</p><h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">Application package</h1><p className="mt-2 text-muted-foreground">Review every claim before sending. Regeneration always returns to grounded source evidence.</p></div><div className="flex gap-2"><button onClick={create} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 hover:bg-accent"><RefreshCw className="size-4" /> Regenerate</button><button onClick={save} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground"><Save className="size-4" /> Save</button></div></header>
    {item.warnings.length > 0 && <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><h2 className="flex items-center gap-2 font-medium"><ShieldAlert className="size-5 text-amber-600" /> Claim review</h2>{item.warnings.map((warning) => <p key={warning.message} className="mt-2 text-sm text-muted-foreground">{warning.message}</p>)}</div>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]"><section className="space-y-5">{(Object.keys(labels) as (keyof typeof labels)[]).map((key) => <article key={key} className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xl">{labels[key]}</h2><button onClick={() => copy(key)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-accent">{copied === key ? <Check className="size-4" /> : <Clipboard className="size-4" />} {copied === key ? "Copied" : "Copy"}</button></div><textarea aria-label={labels[key]} className="mt-4 min-h-52 w-full rounded-lg border bg-input-background p-4 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={item.content[key]} onChange={(event) => setItem({ ...item, content: { ...item.content, [key]: event.target.value } })} /></article>)}</section><aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24"><h2 className="text-xl">Claim sources</h2><p className="mt-1 text-sm text-muted-foreground">These are the facts used to assemble the package.</p><div className="mt-4 space-y-3">{Object.entries(item.source_map).map(([key, source]) => <div key={key} className="rounded-lg bg-muted/60 p-3"><p className="text-xs uppercase tracking-wide text-primary">{source.type.replace("_", " ")}</p><p className="mt-2 text-sm">{source.quote}</p>{source.source_note && <p className="mt-2 text-xs text-muted-foreground">Source: {source.source_note}</p>}</div>)}</div></aside></div>
  </main>;
}

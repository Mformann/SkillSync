import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

type Achievement = { id: number; title: string; statement: string; skills: string[]; source_note: string; source_url: string | null; verification_status: string };
type Vault = { full_name: string | null; headline: string | null; location: string | null; email: string | null; phone: string | null; links: string[]; role_preferences: string[]; achievements: Achievement[] };
const field = "mt-1 min-h-11 w-full rounded-lg border border-input bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CareerVaultPage() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const load = () => api.get<Vault>("/product/vault").then((response) => setVault(response.data));
  useEffect(() => { void load(); }, []);
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy("profile");
    const response = await api.put<Vault>("/product/vault", {
      full_name: data.get("full_name") || null, headline: data.get("headline") || null,
      location: data.get("location") || null, email: data.get("email") || null, phone: data.get("phone") || null,
      links: String(data.get("links") || "").split(",").map((value) => value.trim()).filter(Boolean),
      role_preferences: String(data.get("roles") || "").split(",").map((value) => value.trim()).filter(Boolean),
    });
    setVault(response.data); setMessage("Career profile saved."); setBusy("");
  };
  const addAchievement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("achievement");
    const response = await api.post<Vault>("/product/vault/achievements", {
      title: data.get("title"), statement: data.get("statement"),
      skills: String(data.get("skills") || "").split(",").map((value) => value.trim()).filter(Boolean),
      source_note: data.get("source_note"), source_url: data.get("source_url") || null,
    });
    setVault(response.data); form.reset(); setMessage("Achievement added as user-attested evidence."); setBusy("");
  };
  const remove = async (id: number) => {
    await api.delete(`/product/vault/achievements/${id}`);
    await load();
  };
  if (!vault) return <main className="flex min-h-[70vh] items-center justify-center" role="status"><Loader2 className="size-7 animate-spin text-primary" /><span className="sr-only">Loading Career Vault</span></main>;
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <Link to="/career" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Career Hub</Link>
    <header className="mt-3"><p className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" /> Reusable verified career facts</p><h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">Career Vault</h1><p className="mt-2 max-w-3xl text-muted-foreground">Store facts once and attach their source. SkillSync can reuse them without inventing experience.</p></header>
    {message && <p aria-live="polite" className="mt-5 rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">{message}</p>}
    <div className="mt-7 grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="rounded-2xl border bg-card p-5"><h2 className="text-xl">Career profile</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Full name<input name="full_name" className={field} defaultValue={vault.full_name || ""} /></label><label className="text-sm">Email<input name="email" type="email" className={field} defaultValue={vault.email || ""} /></label><label className="text-sm">Phone<input name="phone" type="tel" className={field} defaultValue={vault.phone || ""} /></label><label className="text-sm">Location<input name="location" className={field} defaultValue={vault.location || ""} /></label></div><label className="mt-4 block text-sm">Professional headline<input name="headline" className={field} defaultValue={vault.headline || ""} /></label><label className="mt-4 block text-sm">Links <span className="font-normal text-muted-foreground">(comma separated)</span><input name="links" className={field} defaultValue={vault.links.join(", ")} /></label><label className="mt-4 block text-sm">Target roles <span className="font-normal text-muted-foreground">(comma separated)</span><input name="roles" className={field} defaultValue={vault.role_preferences.join(", ")} /></label><button disabled={busy === "profile"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">{busy === "profile" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile</button></form>
      <form onSubmit={addAchievement} className="rounded-2xl border bg-card p-5"><h2 className="text-xl">Add an achievement</h2><p className="mt-1 text-sm text-muted-foreground">Every entry needs a source note so later claims remain traceable.</p><label className="mt-4 block text-sm">Title<input required minLength={2} name="title" className={field} /></label><label className="mt-4 block text-sm">Factual achievement statement<textarea required minLength={10} name="statement" className={`${field} min-h-28 py-3`} /></label><label className="mt-4 block text-sm">Skills<input name="skills" className={field} placeholder="React, accessibility, testing" /></label><label className="mt-4 block text-sm">Where can you verify this?<input required minLength={3} name="source_note" className={field} placeholder="Performance report, GitHub repository, certificate…" /></label><label className="mt-4 block text-sm">Optional source URL<input type="url" name="source_url" className={field} /></label><button disabled={busy === "achievement"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 hover:bg-accent disabled:opacity-50"><Plus className="size-4" /> Add evidence</button></form>
    </div>
    <section className="mt-6 rounded-2xl border bg-card p-5"><h2 className="text-xl">Achievement bank</h2>{vault.achievements.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{vault.achievements.map((item) => <article key={item.id} className="rounded-xl bg-muted/60 p-4"><div className="flex justify-between gap-3"><div><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-xs uppercase tracking-wide text-primary">{item.verification_status.replace("_", " ")}</p></div><button onClick={() => remove(item.id)} aria-label={`Delete ${item.title}`} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button></div><p className="mt-3 text-sm">{item.statement}</p><p className="mt-3 text-xs text-muted-foreground">Source: {item.source_note}</p><p className="mt-2 text-xs text-primary">{item.skills.join(" · ")}</p></article>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No achievements saved yet.</p>}</section>
  </main>;
}

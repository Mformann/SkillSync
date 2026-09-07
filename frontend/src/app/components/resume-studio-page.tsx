import axios from "axios";
import { AlertTriangle, ArrowLeft, Download, FilePlus2, Loader2, Printer, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";

type Evidence = { id: string; text: string; requirement: string };
type Content = {
  basics: { name: string; email: string; phone: string; location: string; links: string[] };
  headline: string;
  summary: string;
  skills: string[];
  evidence: Evidence[];
};
type Warning = { code: string; severity: "high" | "medium"; message: string; evidence_id?: string };
type Version = {
  id: number; name: string; template: "classic" | "modern"; content: Content;
  warnings: Warning[]; created_at: string; updated_at: string;
};

const inputClass = "min-h-11 w-full rounded-lg border border-input bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ResumeStudioPage() {
  const { id } = useParams();
  const [versions, setVersions] = useState<Version[]>([]);
  const [current, setCurrent] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!id || id === "latest") {
      setError("Open Resume Studio from a completed analysis.");
      setLoading(false);
      return;
    }
    try {
      let items = (await api.get<Version[]>(`/resume-studio/analyses/${id}/versions`)).data;
      if (!items.length) {
        items = [(await api.post<Version>(`/resume-studio/analyses/${id}/versions`, {})).data];
      }
      setVersions(items);
      setCurrent(items[0]);
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError) ? requestError.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Resume Studio could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const patchContent = (patch: Partial<Content>) => {
    if (current) setCurrent({ ...current, content: { ...current.content, ...patch } });
  };
  const patchBasics = (key: keyof Content["basics"], value: string) => {
    if (current) patchContent({ basics: { ...current.content.basics, [key]: value } });
  };
  const save = async () => {
    if (!current) return;
    setSaving(true);
    setError("");
    try {
      const saved = (await api.patch<Version>(`/resume-studio/versions/${current.id}`, {
        name: current.name, template: current.template, content: current.content,
      })).data;
      setCurrent(saved);
      setVersions((items) => items.map((item) => item.id === saved.id ? saved : item));
    } catch {
      setError("Your changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const createVersion = async () => {
    if (!id || id === "latest") return;
    const created = (await api.post<Version>(`/resume-studio/analyses/${id}/versions`, {})).data;
    setVersions((items) => [created, ...items]);
    setCurrent(created);
  };
  const download = async () => {
    if (!current) return;
    const response = await api.get(`/resume-studio/versions/${current.id}/docx`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${current.name}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <main className="flex min-h-[70vh] items-center justify-center" role="status"><Loader2 className="size-7 animate-spin text-primary" /><span className="sr-only">Loading Resume Studio</span></main>;
  if (error && !current) return <main className="mx-auto max-w-xl px-4 py-20 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h1 className="mt-4 text-2xl">Resume Studio unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-lg border px-5" to="/workspaces">Target jobs</Link></main>;
  if (!current) return null;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6">
      <div className="resume-studio-controls mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Link to={`/analysis/${id}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Analysis</Link>
          <h1 className="mt-2 text-3xl tracking-tight">Truth-first Resume Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tailor verified evidence, review warnings, then export an ATS-readable document.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={createVersion} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4"><FilePlus2 className="size-4" /> New version</button>
          <button onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4"><Printer className="size-4" /> Print / PDF</button>
          <button onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4"><Download className="size-4" /> DOCX</button>
          <button onClick={save} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-60">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</button>
        </div>
      </div>
      {error && <p className="resume-studio-controls mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="grid gap-6 xl:grid-cols-[minmax(330px,0.75fr)_minmax(540px,1.25fr)]">
        <section className="resume-studio-controls space-y-5 rounded-2xl border bg-card p-5" aria-label="Resume editor">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Version name<input className={`${inputClass} mt-1`} value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} /></label>
            <label className="text-sm">ATS-safe template<select className={`${inputClass} mt-1`} value={current.template} onChange={(e) => setCurrent({ ...current, template: e.target.value as Version["template"] })}><option value="classic">Classic centered</option><option value="modern">Modern left-aligned</option></select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["name", "email", "phone", "location"] as const).map((key) => <label key={key} className="text-sm capitalize">{key}<input className={`${inputClass} mt-1`} value={current.content.basics[key]} onChange={(e) => patchBasics(key, e.target.value)} /></label>)}
          </div>
          <label className="block text-sm">Target headline<input className={`${inputClass} mt-1`} value={current.content.headline} onChange={(e) => patchContent({ headline: e.target.value })} /></label>
          <label className="block text-sm">Professional summary<textarea className={`${inputClass} mt-1 min-h-28 py-3`} value={current.content.summary} onChange={(e) => patchContent({ summary: e.target.value })} /></label>
          <label className="block text-sm">Verified skills <span className="font-normal text-muted-foreground">(comma separated)</span><textarea className={`${inputClass} mt-1 min-h-20 py-3`} value={current.content.skills.join(", ")} onChange={(e) => patchContent({ skills: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
          <div><h2 className="text-base">Evidence bullets</h2><p className="text-xs text-muted-foreground">Edits are checked for numbers absent from the original evidence.</p>
            <div className="mt-3 space-y-3">{current.content.evidence.map((item, index) => <label key={item.id} className="block text-sm"><span className="text-xs text-primary">{item.requirement || `Evidence ${index + 1}`}</span><textarea className={`${inputClass} mt-1 min-h-24 py-3`} value={item.text} onChange={(e) => patchContent({ evidence: current.content.evidence.map((entry) => entry.id === item.id ? { ...entry, text: e.target.value } : entry) })} /></label>)}</div>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <h2 className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-primary" /> Claim review</h2>
            {current.warnings.length ? <ul className="mt-3 space-y-2">{current.warnings.map((warning, index) => <li key={`${warning.code}-${index}`} className={warning.severity === "high" ? "text-sm text-destructive" : "text-sm text-amber-700 dark:text-amber-300"}>{warning.message}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No automatic claim warnings. You remain responsible for final accuracy.</p>}
          </div>
          <label className="block text-sm">Version history<select className={`${inputClass} mt-1`} value={current.id} onChange={(e) => setCurrent(versions.find((item) => item.id === Number(e.target.value)) || current)}>{versions.map((version) => <option key={version.id} value={version.id}>{version.name} · {new Date(version.updated_at).toLocaleDateString()}</option>)}</select></label>
        </section>
        <section className={`resume-print-sheet min-h-[1056px] bg-white px-12 py-11 text-slate-900 shadow-xl ${current.template === "classic" ? "text-center" : "text-left"}`} aria-label="Resume preview">
          <header><h2 className="text-3xl font-bold tracking-wide">{current.content.basics.name || "YOUR NAME"}</h2><p className="mt-2 text-sm">{[current.content.basics.email, current.content.basics.phone, current.content.basics.location, ...current.content.basics.links].filter(Boolean).join(" | ")}</p><p className="mt-2 font-semibold">{current.content.headline}</p></header>
          <div className="mt-8 text-left">
            <ResumeSection title="Professional Summary"><p>{current.content.summary}</p></ResumeSection>
            <ResumeSection title="Relevant Skills"><p>{current.content.skills.join(" • ")}</p></ResumeSection>
            <ResumeSection title="Selected Evidence"><ul className="list-disc space-y-2 pl-5">{current.content.evidence.map((item) => <li key={item.id}>{item.text}</li>)}</ul></ResumeSection>
          </div>
        </section>
      </div>
    </main>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-7"><h3 className="mb-3 border-b border-slate-400 pb-1 text-sm font-bold uppercase tracking-widest">{title}</h3><div className="text-[11pt] leading-relaxed">{children}</div></section>;
}

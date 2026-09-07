import { useState } from "react";
import { ArrowLeft, Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export function PrivacyPage() {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const download = async () => {
    setBusy("export");
    const response = await api.get("/product/privacy/export");
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "skillsync-data-export.json"; anchor.click(); URL.revokeObjectURL(url); setBusy("");
  };
  const remove = async () => {
    setBusy("delete"); setError("");
    try { await api.post("/product/privacy/delete-app-data", { confirmation }); navigate("/dashboard"); }
    catch { setError("The confirmation phrase must match exactly."); setBusy(""); }
  };
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Link to="/career" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Career Hub</Link><header className="mt-3"><p className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" /> User-controlled data</p><h1 className="mt-2 text-3xl tracking-tight">Privacy and data controls</h1><p className="mt-2 text-muted-foreground">Export your stored career data or permanently remove SkillSync application data.</p></header><section className="mt-7 rounded-2xl border bg-card p-6"><h2 className="text-xl">Export data</h2><p className="mt-2 text-sm text-muted-foreground">Downloads your career profile, target jobs, applications, and portfolio evidence as JSON.</p><button onClick={download} disabled={Boolean(busy)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 hover:bg-accent disabled:opacity-50">{busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download export</button></section><section className="mt-6 rounded-2xl border border-destructive/30 bg-card p-6"><h2 className="text-xl text-destructive">Delete SkillSync data</h2><p className="mt-2 text-sm text-muted-foreground">This permanently deletes your workspaces, analyses, roadmaps, resumes, career evidence, packages, and tracking data. Your Supabase identity account is not deleted.</p><label className="mt-4 block text-sm">Type <strong>DELETE MY SKILLSYNC DATA</strong> to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border bg-input-background px-3" /></label>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<button onClick={remove} disabled={busy === "delete" || confirmation !== "DELETE MY SKILLSYNC DATA"} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-destructive px-4 text-destructive-foreground disabled:opacity-40">{busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Permanently delete app data</button></section></main>;
}

import axios from "axios";
import {
  ArrowRight, BriefcaseBusiness, CheckCircle2, ExternalLink, FileCheck2,
  FolderCheck, Loader2, MessageSquareText, PackageCheck, Plus, Save, ShieldCheck, Target,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

type Application = { status: string; job_url: string | null; next_action: string | null; next_action_date: string | null; notes: string | null };
type Readiness = { overall: number; components: Record<string, number>; next_best_action: string; formula_version: string };
type WorkspaceSummary = { workspace_id: number; title: string; company: string | null; analysis_id: number | null; application: Application | null; readiness: Readiness | null };
type Evidence = { id: number; title: string; evidence_type: string; url: string | null; description: string; skills: string[]; verified: boolean };
type Question = { id: string; requirement: string; status: string; question: string; focus: string };
type Score = { overall: number; specificity: number; structure: number; evidence: number; feedback: string[] };
type Session = { id: number; questions: Question[]; answers: Record<string, string>; scores: Record<string, Score>; status: string };
type Detail = WorkspaceSummary & { evidence: Evidence[]; sessions: Session[] };
type Analytics = { unique_applications: number; screening_rate: number; interview_rate: number; offer_rate: number; note: string };

const field = "min-h-11 w-full rounded-lg border border-input bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const statusLabels: Record<string, string> = {
  preparing: "Preparing", applied: "Applied", screening: "Screening", interviewing: "Interviewing",
  offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};

export function CareerHubPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadSummary = async () => {
    const items = (await api.get<WorkspaceSummary[]>("/career/workspaces")).data;
    setWorkspaces(items);
    if (!selectedId && items.length) setSelectedId(items[0].workspace_id);
    return items;
  };
  const loadDetail = async (workspaceId: number) => {
    setDetail((await api.get<Detail>(`/career/workspaces/${workspaceId}`)).data);
  };
  useEffect(() => {
    loadSummary().catch(() => setError("Career Hub could not be loaded.")).finally(() => setLoading(false));
    api.get<Analytics>("/product/analytics").then((response) => setAnalytics(response.data)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId).catch(() => setError("This target job could not be loaded."));
  }, [selectedId]);

  const refresh = async () => {
    if (!selectedId) return;
    await Promise.all([loadSummary(), loadDetail(selectedId)]);
  };
  const saveApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    const data = new FormData(event.currentTarget);
    setBusy("application");
    try {
      await api.put(`/career/workspaces/${detail.workspace_id}/application`, {
        status: data.get("status"), job_url: data.get("job_url") || null,
        next_action: data.get("next_action") || null, next_action_date: data.get("next_action_date") || null,
        notes: data.get("notes") || null,
      });
      await refresh();
    } catch { setError("Application changes could not be saved."); }
    finally { setBusy(""); }
  };
  const addEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("evidence");
    try {
      await api.post(`/career/workspaces/${detail.workspace_id}/evidence`, {
        title: data.get("title"), evidence_type: data.get("evidence_type"), url: data.get("url") || null,
        description: data.get("description"),
        skills: String(data.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean),
      });
      form.reset();
      await refresh();
    } catch (requestError) {
      const message = axios.isAxiosError(requestError) ? requestError.response?.data?.detail : null;
      setError(typeof message === "string" ? message : "Evidence could not be added.");
    } finally { setBusy(""); }
  };
  const startPractice = async () => {
    if (!detail) return;
    setBusy("practice");
    try { await api.post(`/career/workspaces/${detail.workspace_id}/interview-sessions`); await refresh(); }
    catch { setError("Complete an explainable analysis before starting practice."); }
    finally { setBusy(""); }
  };
  const saveAnswer = async (sessionId: number, questionId: string, answer: string) => {
    setBusy(questionId);
    try {
      const updated = (await api.patch<Session>(`/career/interview-sessions/${sessionId}/answer`, { question_id: questionId, answer })).data;
      setDetail((current) => current ? { ...current, sessions: current.sessions.map((item) => item.id === updated.id ? updated : item) } : current);
    } catch { setError("Use at least 20 characters so the answer can be reviewed."); }
    finally { setBusy(""); }
  };

  if (loading) return <main className="flex min-h-[70vh] items-center justify-center" role="status"><Loader2 className="size-7 animate-spin text-primary" /><span className="sr-only">Loading Career Hub</span></main>;
  if (!workspaces.length) return <main className="mx-auto max-w-xl px-4 py-20 text-center"><Target className="mx-auto size-11 text-primary" /><h1 className="mt-4 text-3xl">Create a target job first</h1><p className="mt-2 text-muted-foreground">Career Hub connects application tracking, proof, and interview practice to a specific opportunity.</p><Link to="/workspaces" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-primary-foreground">Create target job <ArrowRight className="size-4" /></Link></main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7">
        <p className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" /> Phase 5 career command center</p>
        <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">Turn preparation into applications</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Track each opportunity, collect verifiable proof, and rehearse answers grounded in the same job analysis.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/career/vault" className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 hover:bg-accent"><FolderCheck className="size-4" /> Career Vault</Link>
          <Link to="/privacy" className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 hover:bg-accent"><ShieldCheck className="size-4" /> Privacy controls</Link>
        </div>
      </header>
      {error && <div role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {analytics && <section className="mb-6 rounded-2xl border bg-card p-5" aria-label="Observed application outcomes"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">Applications tracked</p><p className="mt-1 text-2xl font-semibold tabular-nums">{analytics.unique_applications}</p></div><div><p className="text-xs text-muted-foreground">Screening rate</p><p className="mt-1 text-2xl font-semibold tabular-nums">{analytics.screening_rate}%</p></div><div><p className="text-xs text-muted-foreground">Interview rate</p><p className="mt-1 text-2xl font-semibold tabular-nums">{analytics.interview_rate}%</p></div><div><p className="text-xs text-muted-foreground">Offer rate</p><p className="mt-1 text-2xl font-semibold tabular-nums">{analytics.offer_rate}%</p></div></div><p className="mt-3 text-xs text-muted-foreground">{analytics.note}</p></section>}
      <div className="mb-6 flex gap-3 overflow-x-auto pb-2" aria-label="Target jobs">
        {workspaces.map((item) => <button key={item.workspace_id} onClick={() => setSelectedId(item.workspace_id)} className={`min-h-12 shrink-0 rounded-xl border px-4 text-left transition-colors ${selectedId === item.workspace_id ? "border-primary bg-primary/10" : "bg-card hover:bg-accent"}`}><span className="block text-sm font-medium">{item.title}</span><span className="block text-xs text-muted-foreground">{item.company || "Company not specified"}</span></button>)}
      </div>
      {!detail ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Career readiness">
            <div className="rounded-xl border bg-card p-5 sm:col-span-2 lg:col-span-2"><p className="text-sm text-muted-foreground">Career readiness</p><p className="mt-2 text-4xl font-semibold tabular-nums">{detail.readiness?.overall || 0}%</p><p className="mt-2 text-sm text-muted-foreground">{detail.readiness?.next_best_action || "Run an analysis to calculate readiness."}</p></div>
            {Object.entries(detail.readiness?.components || {}).map(([key, value]) => <div key={key} className="rounded-xl border bg-card p-4"><p className="text-xs capitalize text-muted-foreground">{key.replace("_", " ")}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}%</p></div>)}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <form key={detail.workspace_id} onSubmit={saveApplication} className="rounded-2xl border bg-card p-5">
              <h2 className="flex items-center gap-2 text-xl"><BriefcaseBusiness className="size-5 text-primary" /> Application pipeline</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">Status<select name="status" className={`${field} mt-1`} defaultValue={detail.application?.status || "preparing"}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-sm">Next-action date<input name="next_action_date" type="date" className={`${field} mt-1`} defaultValue={detail.application?.next_action_date || ""} /></label>
              </div>
              <label className="mt-4 block text-sm">Job posting URL<input name="job_url" type="url" className={`${field} mt-1`} defaultValue={detail.application?.job_url || ""} /></label>
              <label className="mt-4 block text-sm">Next action<input name="next_action" className={`${field} mt-1`} defaultValue={detail.application?.next_action || ""} placeholder="Example: Send portfolio to recruiter" /></label>
              <label className="mt-4 block text-sm">Private notes<textarea name="notes" className={`${field} mt-1 min-h-24 py-3`} defaultValue={detail.application?.notes || ""} /></label>
              <button disabled={busy === "application"} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">{busy === "application" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save application</button>
            </form>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="flex items-center gap-2 text-xl"><FileCheck2 className="size-5 text-primary" /> Portfolio proof</h2>
              <div className="mt-4 space-y-3">{detail.evidence.map((item) => <article key={item.id} className="rounded-lg bg-muted/60 p-4"><div className="flex justify-between gap-3"><h3 className="text-sm font-medium">{item.title}</h3><span className="text-xs capitalize text-muted-foreground">{item.evidence_type.replace("_", " ")}</span></div><p className="mt-2 text-sm text-muted-foreground">{item.description}</p><p className="mt-2 text-xs text-primary">{item.skills.join(" · ")}</p>{item.url && <a className="mt-2 inline-flex items-center gap-1 text-xs underline" href={item.url} target="_blank" rel="noreferrer">Open evidence <ExternalLink className="size-3" /></a>}</article>)}</div>
              <form onSubmit={addEvidence} className="mt-5 border-t pt-5">
                <h3 className="text-sm font-medium">Add verifiable evidence</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Title<input required minLength={2} name="title" className={`${field} mt-1`} /></label><label className="text-sm">Type<select name="evidence_type" className={`${field} mt-1`}><option value="project">Project</option><option value="case_study">Case study</option><option value="demo">Demo</option><option value="certificate">Certificate</option><option value="writing">Writing</option><option value="other">Other</option></select></label></div>
                <label className="mt-3 block text-sm">Description<textarea required minLength={10} name="description" className={`${field} mt-1 min-h-20 py-3`} /></label>
                <label className="mt-3 block text-sm">Evidence URL<input name="url" type="url" className={`${field} mt-1`} /></label>
                <label className="mt-3 block text-sm">Skills <span className="font-normal text-muted-foreground">(comma separated)</span><input name="skills" className={`${field} mt-1`} /></label>
                <button disabled={busy === "evidence"} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 hover:bg-accent disabled:opacity-50"><Plus className="size-4" /> Add evidence</button>
              </form>
            </section>
          </div>

          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="flex items-center gap-2 text-xl"><MessageSquareText className="size-5 text-primary" /> Grounded interview practice</h2><p className="mt-1 text-sm text-muted-foreground">Questions come from required skills, verified strengths, and honest evidence gaps.</p></div><button onClick={startPractice} disabled={busy === "practice" || !detail.analysis_id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50"><Plus className="size-4" /> New practice set</button></div>
            {!detail.sessions.length ? <div className="mt-6 rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">Start a practice set after completing the job analysis.</div> : <PracticeSession session={detail.sessions[0]} busy={busy} onSave={saveAnswer} />}
          </section>
          {detail.analysis_id && <Link to={`/career/package/${detail.workspace_id}`} className="flex min-h-14 items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-5 hover:bg-primary/15"><span className="flex items-center gap-3"><PackageCheck className="size-5 text-primary" /><span><strong className="block">Build complete application package</strong><span className="text-sm text-muted-foreground">Grounded cover letter, recruiter outreach, and follow-up.</span></span></span><ArrowRight className="size-5" /></Link>}
        </div>
      )}
    </main>
  );
}

function PracticeSession({ session, busy, onSave }: { session: Session; busy: string; onSave: (sessionId: number, questionId: string, answer: string) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>(session.answers);
  useEffect(() => setDrafts(session.answers), [session]);
  return <div className="mt-6 space-y-4">{session.questions.map((question, index) => {
    const score = session.scores[question.id];
    return <article key={question.id} className="rounded-xl border p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Question {index + 1} · {question.requirement}</p><h3 className="mt-2">{question.question}</h3><p className="mt-2 text-sm text-muted-foreground">{question.focus}</p><label className="mt-4 block text-sm">Your answer<textarea className={`${field} mt-1 min-h-32 py-3`} value={drafts[question.id] || ""} onChange={(event) => setDrafts({ ...drafts, [question.id]: event.target.value })} /></label><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button onClick={() => onSave(session.id, question.id, drafts[question.id] || "")} disabled={busy === question.id} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 hover:bg-accent disabled:opacity-50">{busy === question.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Review answer</button>{score && <span className="text-sm font-medium">Practice score: {score.overall}%</span>}</div>{score && <ul className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{score.feedback.map((item) => <li key={item}>• {item}</li>)}</ul>}</article>;
  })}</div>;
}

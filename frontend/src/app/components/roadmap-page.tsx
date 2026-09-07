import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Code2,
  ExternalLink,
  FileCheck2,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  Route,
  Target,
  Youtube,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";

type YouTubeResource = {
  title: string;
  channel: string;
  url: string;
  duration?: string;
};

type PracticalTest = {
  micro_challenge: string;
  project_deliverable: string;
  checklist: string[];
};

type Task = {
  id: number;
  skill: string;
  title: string;
  category: string;
  order_index: number;
  priority_score: number;
  estimated_hours: number;
  status: "pending" | "in_progress" | "completed";
  progress: number;
  due_date: string;
  prerequisites: string[];
  resource: {
    title: string;
    url: string;
    provider: string;
    free: boolean;
    youtube?: YouTubeResource[];
    practical_test?: PracticalTest;
  };
  practical_test?: PracticalTest;
  objective: string;
  project_brief: string;
  assessment_criteria: string;
  evidence_url: string | null;
  reflection: string | null;
};

type Plan = {
  id: number;
  analysis_id: number;
  workspace_id: number;
  hours_per_week: number;
  target_date: string;
  experience_level: string;
  total_estimated_hours: number;
  overall_progress: number;
  readiness: string;
  completed_tasks: number;
  total_tasks: number;
  tasks: Task[];
};

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function TaskCard({
  task,
  onUpdated,
}: {
  task: Task;
  onUpdated: (plan: Plan) => void;
}) {
  const [evidence, setEvidence] = useState(task.evidence_url || "");
  const [reflection, setReflection] = useState(task.reflection || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checklistState, setChecklistState] = useState<Record<number, boolean>>({});

  const youtubeVideos: YouTubeResource[] = task.resource?.youtube || [];
  const practical: PracticalTest | undefined = task.practical_test || task.resource?.practical_test;
  const checklist: string[] = practical?.checklist || (
    task.assessment_criteria ? task.assessment_criteria.split(" | ") : []
  );

  const toggleCheck = (index: number) => {
    setChecklistState((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const update = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const response = await api.patch<{ task: Task; plan: Plan }>(`/learning/tasks/${task.id}`, payload);
      onUpdated(response.data.plan);
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError) ? requestError.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Progress could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className={`rounded-2xl border bg-card p-5 sm:p-6 transition-all ${task.status === "completed" ? "border-green-500/30" : "border-border shadow-sm"}`}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${task.status === "completed" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-primary/10 text-primary"}`}>
            {task.status === "completed" ? <CheckCircle2 className="size-5" /> : <span className="font-semibold">{task.order_index}</span>}
          </div>
          <div>
            <h3 className="text-lg font-medium tracking-tight">{task.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-2.5 py-1">{task.estimated_hours} hours</span>
              <span className="rounded-full bg-secondary px-2.5 py-1">Due {new Date(`${task.due_date}T00:00:00`).toLocaleDateString()}</span>
              <span className="rounded-full bg-secondary px-2.5 py-1">Priority {task.priority_score}</span>
            </div>
          </div>
        </div>
        <span className="text-sm font-semibold tabular-nums text-primary">{task.progress}%</span>
      </div>

      {/* Progress Bar */}
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${task.skill} progress: ${task.progress}%`}>
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${task.progress}%` }} />
      </div>

      {task.prerequisites.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Prerequisites:</strong> {task.prerequisites.join(", ")}
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{task.objective}</p>

      {/* YouTube Video Tutorials */}
      {youtubeVideos.length > 0 && (
        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            <Youtube className="size-4" /> Recommended YouTube Tutorials
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {youtubeVideos.map((video, idx) => (
              <a
                key={idx}
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col justify-between rounded-lg border border-border bg-card p-3 transition-all hover:border-red-500/40 hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                      <Play className="size-2.5 fill-current" /> {video.channel}
                    </span>
                    {video.duration && (
                      <span className="text-[10px] text-muted-foreground">{video.duration}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-medium text-foreground line-clamp-2 transition-colors group-hover:text-red-600 dark:group-hover:text-red-400">
                    {video.title}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary">
                  Watch Video <ExternalLink className="size-3" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Practical Skill Tests & Project Challenges */}
      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Code2 className="size-4" /> 1. Micro-Challenge (1–2 hrs)
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {practical?.micro_challenge || "Build a focused prototype or test script demonstrating foundational concepts."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="size-4" /> 2. Portfolio Project Deliverable
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {practical?.project_deliverable || task.project_brief}
          </p>
        </div>

        {/* Interactive Verification Checklist */}
        {checklist.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListChecks className="size-4" /> 3. Practical Verification Checklist
              </div>
              <span className="text-xs text-muted-foreground">
                {Object.values(checklistState).filter(Boolean).length}/{checklist.length} Passed
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {checklist.map((item, idx) => (
                <label
                  key={idx}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 text-xs leading-relaxed transition-colors hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checklistState[idx])}
                    onChange={() => toggleCheck(idx)}
                    className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className={checklistState[idx] ? "line-through text-muted-foreground" : "text-foreground"}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Official Documentation Link */}
      {task.resource?.url && (
        <a
          href={task.resource.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-accent"
        >
          <BookOpen className="size-4" /> {task.resource.title}
          <span className="text-muted-foreground">· Free Official Docs</span>
          <ExternalLink className="size-3" />
        </a>
      )}

      {/* Progress & Evidence Controls */}
      {task.status !== "completed" && (
        <div className="mt-5 border-t border-border pt-5">
          <button
            onClick={() => update({ progress: Math.min(90, task.progress + 25) })}
            disabled={saving || task.progress >= 90}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-accent disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />}
            Record study progress (+25%)
          </button>

          <details className="mt-4 rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-medium text-sm">Submit project evidence to validate completion</summary>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor={`evidence-${task.id}`} className="mb-2 block text-sm">Evidence URL (GitHub repository or live demo)</label>
                <input
                  id={`evidence-${task.id}`}
                  type="url"
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  placeholder="https://github.com/your-username/project"
                  className="min-h-11 w-full rounded-lg border border-input bg-input-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor={`reflection-${task.id}`} className="mb-2 block text-sm">What did you build or demonstrate?</label>
                <textarea
                  id={`reflection-${task.id}`}
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  rows={3}
                  placeholder="Describe the outcome, what challenges you solved, and what you can now explain in an interview…"
                  className="w-full rounded-lg border border-input bg-input-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={() => update({ progress: 100, evidence_url: evidence, reflection })}
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-60"
              >
                <FileCheck2 className="size-4" /> Validate completion (100%)
              </button>
            </div>
          </details>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    </article>
  );
}

export function RoadmapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const analysisId = id && id !== "latest" ? Number(id) : null;
  const [resolvedAnalysisId, setResolvedAnalysisId] = useState<number | null>(analysisId);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [hours, setHours] = useState(7);
  const [targetDate, setTargetDate] = useState(dateAfter(30));
  const [level, setLevel] = useState("intermediate");

  useEffect(() => {
    setLoading(true);
    const endpoint = analysisId
      ? `/learning/plans/by-analysis/${analysisId}`
      : "/learning/plans/latest";
    api.get<Plan>(endpoint)
      .then((response) => {
        setPlan(response.data);
        setResolvedAnalysisId(response.data.analysis_id);
      })
      .catch(async (requestError) => {
        if (!axios.isAxiosError(requestError) || requestError.response?.status !== 404) {
          setError("The learning plan could not be loaded.");
        } else {
          // If no plan yet, try to discover the user's latest analysis to configure a plan
          try {
            const latestAnalysis = await api.get<{ analysis_id: number }>("/resume/analysis/latest/explainable");
            if (latestAnalysis.data?.analysis_id) {
              setResolvedAnalysisId(latestAnalysis.data.analysis_id);
              setError("");
            }
          } catch {
            if (!analysisId) {
              setError("Open a completed job analysis to create your first learning plan.");
            }
          }
        }
      })
      .finally(() => setLoading(false));
  }, [analysisId]);

  const createPlan = async (event: FormEvent) => {
    event.preventDefault();
    const targetAnalysisId = analysisId || resolvedAnalysisId;
    if (!targetAnalysisId) {
      setError("Please create or select a target-job analysis first.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const response = await api.post<Plan>("/learning/plans", {
        analysis_id: targetAnalysisId,
        hours_per_week: hours,
        target_date: targetDate,
        experience_level: level,
      });
      setPlan(response.data);
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError) ? requestError.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "The learning plan could not be created.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  if (!plan) {
    const targetAnalysisId = analysisId || resolvedAnalysisId;
    if (!targetAnalysisId) {
      return (
        <main className="flex min-h-[65vh] items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <Route className="mx-auto size-12 text-primary" />
            <h1 className="mt-4 text-2xl font-semibold">No learning roadmap yet</h1>
            <p className="mt-2 text-muted-foreground">{error || "Upload a resume and job description to generate your personalized learning plan."}</p>
            <Link to="/upload" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-primary-foreground">
              Create target job & analysis
            </Link>
          </div>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button onClick={() => navigate(-1)} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </button>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10"><Route className="size-6 text-primary" /></div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Plan your shortest useful path</h1>
          <p className="mt-3 text-muted-foreground">
            SkillSync prioritizes job-critical gaps, respects prerequisites, and fits work into your available time.
          </p>
          <form onSubmit={createPlan} className="mt-8 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="hours" className="mb-2 block text-sm font-medium">Hours available each week</label>
              <input id="hours" type="number" min={1} max={40} value={hours} onChange={(event) => setHours(Number(event.target.value))} className="min-h-11 w-full rounded-lg border border-input bg-input-background px-3" />
            </div>
            <div>
              <label htmlFor="target-date" className="mb-2 block text-sm font-medium">Target application date</label>
              <input id="target-date" type="date" min={dateAfter(1)} max={dateAfter(365)} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-input-background px-3" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="level" className="mb-2 block text-sm font-medium">Current experience level</label>
              <select id="level" value={level} onChange={(event) => setLevel(event.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-input-background px-3">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            {error && <p className="sm:col-span-2 text-sm text-destructive" role="alert">{error}</p>}
            <button disabled={creating} className="sm:col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-60">
              {creating && <Loader2 className="size-4 animate-spin" />} Generate learning plan
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <Link to={`/analysis/${plan.analysis_id}`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> View full analysis
          </Link>
          <h1 className="text-3xl tracking-tight sm:text-4xl font-bold">Learning roadmap</h1>
          <p className="mt-2 text-muted-foreground">{plan.readiness} · Target {new Date(`${plan.target_date}T00:00:00`).toLocaleDateString()}</p>
        </div>
        <button onClick={() => setPlan(null)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-accent">
          <RefreshCw className="size-4" /> Recalculate plan
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Target, label: "Overall progress", value: `${plan.overall_progress}%` },
          { icon: Clock3, label: "Estimated effort", value: `${plan.total_estimated_hours}h` },
          { icon: CalendarDays, label: "Weekly capacity", value: `${plan.hours_per_week}h` },
          { icon: CheckCircle2, label: "Tasks completed", value: `${plan.completed_tasks}/${plan.total_tasks}` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-5">
            <item.icon className="size-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-secondary" aria-label={`Overall learning progress: ${plan.overall_progress}%`}>
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${plan.overall_progress}%` }} />
      </div>

      {error && <div className="mt-6 flex gap-2 rounded-xl bg-destructive/10 p-4 text-destructive"><AlertCircle className="size-5" />{error}</div>}

      <section className="mt-8 space-y-5">
        {plan.tasks.map((task) => <TaskCard key={task.id} task={task} onUpdated={setPlan} />)}
      </section>
    </main>
  );
}

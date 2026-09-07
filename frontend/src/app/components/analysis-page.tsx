import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileSearch,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";

type MatchStatus =
  | "strong_match"
  | "partial_match"
  | "transferable"
  | "poorly_demonstrated"
  | "missing_evidence"
  | "missing_skill";

type Requirement = {
  name: string;
  category: string;
  priority: "required" | "preferred";
  importance: number;
  rationale: string;
};

type RequirementMatch = {
  requirement_name: string;
  status: MatchStatus;
  evidence_quotes: string[];
  explanation: string;
  confidence: number;
  recommended_action: string;
};

type ExplainableResponse = {
  analysis_id: number;
  workspace_id: number | null;
  status: string;
  provider: string | null;
  model: string | null;
  prompt_version: string | null;
  fallback_reason: string | null;
  context: {
    job_title: string | null;
    company: string | null;
    resume_filename: string | null;
  };
  scores: {
    overall: number;
    required: number;
    preferred: number;
    evidence_confidence: number;
    status_counts: Record<MatchStatus, number>;
    formula_version: string;
  } | null;
  result: {
    summary: string;
    candidate_positioning: string;
    requirements: Requirement[];
    matches: RequirementMatch[];
    strengths: { title: string; evidence: string; why_relevant: string }[];
    resume_risks: {
      title: string;
      severity: "high" | "medium" | "low";
      explanation: string;
      recommended_action: string;
    }[];
  } | null;
};

const statusMeta: Record<MatchStatus, { label: string; classes: string }> = {
  strong_match: { label: "Strong match", classes: "bg-green-500/10 text-green-700 dark:text-green-300" },
  partial_match: { label: "Partial match", classes: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  transferable: { label: "Transferable", classes: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  poorly_demonstrated: { label: "Needs clearer evidence", classes: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  missing_evidence: { label: "Missing evidence", classes: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  missing_skill: { label: "Missing skill", classes: "bg-destructive/10 text-destructive" },
};

function ScoreCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  const tone = value >= 75 ? "text-green-600 dark:text-green-400" : value >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${tone}`}>{value}%</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p>
    </div>
  );
}

export function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<ExplainableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "required" | "gaps">("all");

  const targetId = id && id !== "latest" ? id : null;
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | string | null>(targetId);

  const runAnalysis = useCallback(async (explicitId?: number | string, force = false) => {
    const aid = explicitId || currentAnalysisId || targetId;
    if (!aid) return;
    setRunning(true);
    setError("");
    try {
      const response = await api.post<ExplainableResponse>(
        `/resume/analysis/${aid}/run`,
        null,
        { params: { force } },
      );
      setData(response.data);
      setCurrentAnalysisId(response.data.analysis_id);
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError) ? requestError.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "The analysis could not be completed.");
    } finally {
      setRunning(false);
    }
  }, [currentAnalysisId, targetId]);

  useEffect(() => {
    const endpoint = targetId
      ? `/resume/analysis/${targetId}/explainable`
      : `/resume/analysis/latest/explainable`;

    setLoading(true);
    api.get<ExplainableResponse>(endpoint)
      .then(async (response) => {
        setData(response.data);
        setCurrentAnalysisId(response.data.analysis_id);
        if (!response.data.result) {
          await runAnalysis(response.data.analysis_id, false);
        }
      })
      .catch((requestError) => {
        if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
          setError("Upload a resume and target job to see your first explainable skill analysis.");
        } else {
          const detail = axios.isAxiosError(requestError) ? requestError.response?.data?.detail : null;
          setError(typeof detail === "string" ? detail : "This analysis could not be loaded.");
        }
      })
      .finally(() => setLoading(false));
  }, [targetId, runAnalysis]);

  const matches = useMemo(() => {
    if (!data?.result) return [];
    const requirements = new Map(data.result.requirements.map((item) => [item.name.toLowerCase(), item]));
    return data.result.matches
      .map((match) => ({ match, requirement: requirements.get(match.requirement_name.toLowerCase()) }))
      .filter((item) => {
        if (filter === "required") return item.requirement?.priority === "required";
        if (filter === "gaps") return ["poorly_demonstrated", "missing_evidence", "missing_skill"].includes(item.match.status);
        return true;
      });
  }, [data, filter]);

  if (loading || (running && !data?.result)) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center px-4" role="status">
        <div className="max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
          <h1 className="mt-5 text-2xl">Comparing evidence to requirements</h1>
          <p className="mt-2 text-muted-foreground">
            We are extracting job requirements and checking what your resume actually demonstrates.
          </p>
        </div>
      </main>
    );
  }

  if (error || !data?.result || !data.scores) {
    return (
      <main className="flex min-h-[65vh] items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <AlertCircle className="mx-auto size-12 text-destructive" />
          <h1 className="mt-4 text-2xl">Analysis unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error || "No explainable result is available yet."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/upload" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Upload Resume & Job
            </Link>
            <Link to="/workspaces" className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm hover:bg-accent">
              Target jobs
            </Link>
            {currentAnalysisId && (
              <button onClick={() => runAnalysis(currentAnalysisId, true)} disabled={running} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm hover:bg-accent">
                <RefreshCw className="size-4" /> Retry Analysis
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const { result, scores } = data;
  const isFallback = data.provider !== "groq";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <button onClick={() => navigate(-1)} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Back
            </button>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BriefcaseBusiness className="size-4" />
              {data.context.company || "Target opportunity"}
            </p>
            <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">{data.context.job_title || "Job match analysis"}</h1>
            <p className="mt-2 text-muted-foreground">Compared with {data.context.resume_filename || "your resume"}</p>
          </div>
          <button
            onClick={() => runAnalysis(undefined, true)}
            disabled={running}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm hover:bg-accent disabled:opacity-60"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Re-run analysis
          </button>
        </header>

        <section className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${isFallback ? "border-amber-500/30 bg-amber-500/10" : "border-green-500/30 bg-green-500/10"}`}>
          {isFallback ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" /> : <Sparkles className="mt-0.5 size-5 shrink-0 text-green-600" />}
          <div>
            <p className="font-medium">{isFallback ? "Limited comparison mode" : "AI-assisted evidence analysis"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFallback
                ? "The free AI provider was unavailable, so this result uses explicit keyword matching. Configure GROQ_API_KEY and re-run for semantic analysis."
                : `Analyzed with ${data.model}. Scores are calculated by SkillSync, not generated by the model.`}
            </p>
            {isFallback && data.fallback_reason && (
              <p className="mt-2 text-xs text-muted-foreground">Reason: {data.fallback_reason}</p>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Match scores">
          <ScoreCard label="Overall match" value={scores.overall} helper="Weighted required and preferred requirements." />
          <ScoreCard label="Required match" value={scores.required} helper="Higher weight is assigned to mandatory requirements." />
          <ScoreCard label="Preferred match" value={scores.preferred} helper="Additional qualifications that strengthen the application." />
          <ScoreCard label="Evidence confidence" value={scores.evidence_confidence} helper="Average confidence in the evidence classifications." />
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <Target className="mt-1 size-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-xl">Candidate positioning</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{result.candidate_positioning}</p>
              <p className="mt-3 text-sm leading-relaxed">{result.summary}</p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_340px]">
          <section>
            <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl">Requirement evidence</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every classification is tied to resume evidence.</p>
              </div>
              <div className="flex rounded-lg border border-border bg-card p-1" aria-label="Filter requirements">
                {(["all", "required", "gaps"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={`min-h-10 rounded-md px-3 text-sm capitalize ${filter === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {matches.map(({ match, requirement }) => (
                <article key={match.requirement_name} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg">{match.requirement_name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta[match.status].classes}`}>
                          {statusMeta[match.status].label}
                        </span>
                        {requirement && (
                          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                            {requirement.priority}
                          </span>
                        )}
                      </div>
                      {requirement && <p className="mt-2 text-sm text-muted-foreground">{requirement.rationale}</p>}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {Math.round(match.confidence * 100)}% confidence
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed">{match.explanation}</p>
                  {match.evidence_quotes.length > 0 ? (
                    <div className="mt-4 rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                      <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                        <FileSearch className="size-4" /> Resume evidence
                      </p>
                      {match.evidence_quotes.map((quote) => (
                        <blockquote key={quote} className="text-sm italic text-muted-foreground">“{quote}”</blockquote>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                      <Info className="size-4 shrink-0" /> No supporting resume excerpt was found.
                    </div>
                  )}
                  <div className="mt-4 flex items-start gap-2 text-sm">
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span><strong>Next action:</strong> {match.recommended_action}</span>
                  </div>
                </article>
              ))}
              {matches.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                  No requirements match this filter.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg"><CheckCircle2 className="size-5 text-green-600" /> Relevant strengths</h2>
              <div className="mt-4 space-y-4">
                {result.strengths.map((strength) => (
                  <div key={strength.title}>
                    <h3 className="text-sm font-medium">{strength.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{strength.why_relevant}</p>
                    <p className="mt-2 border-l-2 border-green-500 pl-3 text-xs italic text-muted-foreground">{strength.evidence}</p>
                  </div>
                ))}
                {result.strengths.length === 0 && <p className="text-sm text-muted-foreground">No verified strengths were returned.</p>}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg"><TriangleAlert className="size-5 text-amber-600" /> Resume risks</h2>
              <div className="mt-4 space-y-4">
                {result.resume_risks.map((risk) => (
                  <div key={risk.title} className="rounded-lg bg-muted/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">{risk.title}</h3>
                      <span className="text-xs uppercase text-muted-foreground">{risk.severity}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{risk.explanation}</p>
                    <p className="mt-2 text-sm">{risk.recommended_action}</p>
                  </div>
                ))}
                {result.resume_risks.length === 0 && <p className="text-sm text-muted-foreground">No additional resume risks were identified.</p>}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 text-sm">
              <h2 className="flex items-center gap-2 font-medium"><ShieldCheck className="size-5 text-primary" /> How scoring works</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                Required items receive 1.5× weight. Strong, partial, transferable, weak-evidence, and missing classifications map to fixed values.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Formula: {scores.formula_version}</p>
            </section>
            {Boolean(currentAnalysisId || data?.analysis_id) && (
              <div className="grid gap-3">
                <Link to={`/resume-studio/${currentAnalysisId || data.analysis_id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                  <FileText className="size-4" /> Tailor verified resume <ArrowRight className="size-4" />
                </Link>
                <Link to={`/roadmap/${currentAnalysisId || data.analysis_id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 hover:bg-accent">
                  Build learning roadmap <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </aside>
        </div>
      </motion.div>
    </main>
  );
}

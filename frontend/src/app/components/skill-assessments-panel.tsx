import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { GrowthCard, GrowthFeedback, ResourceFeedback, growthButton, growthField, growthSecondary, useGrowthAction, useGrowthResource } from "./growth-ui";

export type SkillAttempt = { id: number; skill: string; score: number | null; created_at: string; submitted_at: string | null; scope: string; questions: { id: string; prompt: string; options: string[] }[]; results?: { id: string; correct: boolean; explanation: string }[]; previous_score?: number | null; improvement?: number | null };

export function SkillAssessmentsPanel() {
  const resource = useGrowthResource<{ supported_skills: string[]; attempts: SkillAttempt[] }>("/growth/assessments");
  const action = useGrowthAction();
  const [skill, setSkill] = useState("React");
  const [attempt, setAttempt] = useState<SkillAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const start = () => action.run(async () => {
    const response = await api.post<SkillAttempt>("/growth/assessments", { skill });
    setAttempt(response.data); setAnswers({}); resource.reload();
  });
  const submit = (event: FormEvent) => { event.preventDefault(); void action.run(async () => {
    const response = await api.post<SkillAttempt>(`/growth/assessments/${attempt?.id}/submit`, { answers });
    setAttempt(response.data); resource.reload(); action.setMessage("Assessment saved. Review your feedback below.");
  }); };
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <GrowthCard title="Assess your knowledge" description="Take a short baseline check, practise, then retest. These unproctored checks measure selected knowledge—not professional certification, project ownership, or complete job readiness.">
      <ResourceFeedback resource={resource} />
      <div className="flex flex-col items-end gap-3 sm:flex-row"><label className="w-full text-sm">Skill<select className={growthField} value={skill} onChange={e => setSkill(e.target.value)}>{(resource.data?.supported_skills || ["React"]).map(s => <option key={s}>{s}</option>)}</select></label><button type="button" className={`${growthButton} shrink-0`} disabled={action.busy || Boolean(attempt && attempt.score === null) || !resource.data} onClick={start}>Start knowledge check</button></div>
      <GrowthFeedback {...action} />
      {attempt && attempt.score === null && <form onSubmit={submit} className="mt-6 space-y-6">
        {attempt.questions.map((question, index) => <fieldset key={question.id} className="rounded-xl border border-border p-4"><legend className="px-1 text-sm font-medium">{index + 1}. {question.prompt}</legend><div className="space-y-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent"><input required type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(a => ({ ...a, [question.id]: optionIndex }))} /><span>{option}</span></label>)}</div></fieldset>)}
        <button className={growthButton} disabled={action.busy || Object.keys(answers).length !== attempt.questions.length}>Submit for grading</button>
      </form>}
      {attempt?.score !== null && attempt?.score !== undefined && <div className="mt-6 rounded-xl border border-border bg-muted p-5"><p className="text-3xl font-medium">{attempt.score}%</p><p className="mt-2 text-sm">{attempt.score >= 80 ? "Knowledge check passed" : "Keep practising and retest"} · Knowledge assessed</p>{attempt.improvement != null && <p className="mt-2 text-sm">Change from previous check: {attempt.improvement > 0 ? "+" : ""}{attempt.improvement} percentage points</p>}<ul className="mt-4 space-y-3 text-sm">{attempt.results?.map(result => <li key={result.id}><span className="font-medium">{result.correct ? "Correct: " : "Review: "}</span>{result.explanation}</li>)}</ul><p className="mt-4 text-xs text-muted-foreground">Retests reuse a small curated question bank. Familiarity can improve scores; do not treat a pass as proof of mastery.</p><button type="button" className={`${growthSecondary} mt-4`} onClick={() => setAttempt(null)}>Choose another check</button></div>}
    </GrowthCard>
    <GrowthCard title="Assessment history" description="Compare baseline and retest results. Unsupported skills remain self-reported.">
      {!resource.loading && !resource.error && !resource.data?.attempts.length && <p className="text-sm text-muted-foreground">Your first assessment will appear here.</p>}
      <div className="space-y-3">{resource.data?.attempts.map(item => <div key={item.id} className="rounded-xl border border-border p-4"><p className="font-medium">{item.skill} <span className="float-right">{item.score === null ? "In progress" : `${item.score}%`}</span></p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()} · {item.score === null ? "Not yet assessed" : "Knowledge assessed"}</p>{item.score === null && <button type="button" className={`${growthSecondary} mt-3`} disabled={action.busy || Boolean(attempt && attempt.score === null && attempt.id !== item.id)} onClick={() => { setAttempt(item); setAnswers({}); }}>Resume check</button>}</div>)}</div>
    </GrowthCard>
  </div>;
}

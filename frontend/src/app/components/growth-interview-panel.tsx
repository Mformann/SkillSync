import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { GrowthCard, GrowthFeedback, ResourceFeedback, growthButton, growthField, growthSecondary, useGrowthAction, useGrowthResource } from "./growth-ui";
import type { GrowthWorkspace } from "./growth-planner-panel";

type Question = { id: string; question: string; requirement: string; parent_id?: string };
type Feedback = { mode: string; overall: number | null; feedback: string[]; follow_up: string; relevance?: number; reasoning?: number; evidence?: number };
type Session = { id: number; questions: Question[]; answers: Record<string, string>; scores: Record<string, Feedback> };

export function GrowthInterviewPanel({ workspace }: { workspace?: GrowthWorkspace }) {
  const resource = useGrowthResource<{ sessions: Session[] }>(workspace ? `/career/workspaces/${workspace.id}` : null);
  const action = useGrowthAction();
  const [active, setActive] = useState<Session | null>(null);
  const [questionId, setQuestionId] = useState("");
  const [answer, setAnswer] = useState("");
  const [consent, setConsent] = useState(false);
  const [latestFeedback, setLatestFeedback] = useState<Feedback | null>(null);
  const questions = active?.questions.filter(q => !(q.id in active.answers)) || [];
  const question = questions.find(q => q.id === questionId) || questions[0];
  const start = () => action.run(async () => { const response = await api.post<Session>(`/career/workspaces/${workspace?.id}/interview-sessions`); setActive(response.data); setQuestionId(response.data.questions[0]?.id || ""); setAnswer(""); setLatestFeedback(null); resource.reload(); });
  const submit = (event: FormEvent) => { event.preventDefault(); void action.run(async () => {
    if (!question || !active) return;
    const response = await api.post<{ feedback: Feedback; follow_up: Question }>(`/growth/interviews/${active.id}/turn`, { question_id: question.id, answer, ai_consent: consent });
    const { feedback, follow_up } = response.data;
    setLatestFeedback(feedback); setActive({ ...active, questions: [...active.questions, follow_up], answers: { ...active.answers, [question.id]: answer }, scores: { ...active.scores, [question.id]: feedback } }); setQuestionId(follow_up.id); setAnswer(""); resource.reload();
  }); };
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><GrowthCard title="Practise a real conversation" description="Answer a job-grounded question, then respond to a contextual follow-up. AI coaching evaluates relevance, reasoning, and supportable evidence. Scores are estimates, not hiring predictions or verified skills.">
    {!workspace?.latest_analysis_id && <p className="mb-4 text-sm text-muted-foreground">Complete a target-job analysis before starting practice.</p>}
    <button type="button" className={growthButton} disabled={action.busy || !workspace?.latest_analysis_id} onClick={start}>Start new practice session</button>
    <GrowthFeedback {...action} />
    {active && question && <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm">Question<select className={growthField} value={question.id} onChange={e => { setQuestionId(e.target.value); setAnswer(""); }}>{questions.map(q => <option key={q.id} value={q.id}>{q.parent_id ? "Follow-up: " : ""}{q.question}</option>)}</select></label><p className="rounded-xl border border-border bg-muted p-4 text-base leading-relaxed">{question.question}</p><label className="block text-sm">Your answer<textarea required minLength={20} maxLength={8000} className={`${growthField} min-h-48`} value={answer} onChange={e => setAnswer(e.target.value)} /></label><label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input className="mt-1" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Allow this question, answer, role, and recent practice turns to be sent to Groq for AI feedback. Avoid confidential or sensitive information.</span></label><p className="text-xs text-muted-foreground">Without consent or a working provider, answers are saved with guided follow-ups and no semantic score. Voice recording is not included in this release.</p><button className={growthButton} disabled={action.busy || answer.trim().length < 20}>Save answer and get follow-up</button></form>}
    {latestFeedback && <div className="mt-6 rounded-xl border border-border bg-muted p-5"><h3 className="font-medium">{latestFeedback.mode === "ai_coaching" ? `AI coaching estimate: ${latestFeedback.overall}%` : "Guided practice · no semantic score"}</h3>{latestFeedback.relevance != null && <p className="mt-2 text-sm">Relevance {latestFeedback.relevance}% · Reasoning {latestFeedback.reasoning}% · Evidence {latestFeedback.evidence}%</p>}<ul className="mt-3 space-y-2 text-sm">{latestFeedback.feedback.map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
    {active && <div className="mt-6 space-y-3"><h3 className="font-medium">Saved conversation</h3>{active.questions.filter(q => q.id in active.answers).map(q => <details key={q.id} className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm">{q.question}</summary><p className="mt-3 whitespace-pre-wrap text-sm">{active.answers[q.id]}</p>{active.scores[q.id]?.feedback.map((f, i) => <p key={i} className="mt-2 text-sm text-muted-foreground">{f}</p>)}</details>)}</div>}
  </GrowthCard><GrowthCard title="Resume previous practice"><ResourceFeedback resource={resource} /><div className="space-y-3">{resource.data?.sessions.map(session => <div key={session.id} className="rounded-xl border border-border p-4"><p className="text-sm">Session #{session.id} · {Object.keys(session.answers).length} answers saved</p><button type="button" className={`${growthSecondary} mt-3`} disabled={action.busy} onClick={() => { setActive(session); setQuestionId(session.questions.find(q => !(q.id in session.answers))?.id || ""); setAnswer(""); setLatestFeedback(null); }}>Resume conversation</button></div>)}{resource.data && !resource.data.sessions.length && <p className="text-sm text-muted-foreground">Your saved sessions will appear here.</p>}</div><Link className={`${growthSecondary} mt-5`} to="/career">Back to Career Hub</Link></GrowthCard></div>;
}

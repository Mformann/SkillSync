import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { downloadBlob, localDate } from "../../lib/growth";
import { GrowthCard, GrowthFeedback, ResourceFeedback, growthButton, growthField, growthSecondary, useGrowthAction, useGrowthResource } from "./growth-ui";

export type GrowthWorkspace = { id: number; title: string; company: string | null; latest_analysis_id: number | null };
type Plan = { id: number; hours_per_week: number; target_date: string; tasks: { id: number; title: string; due_date: string; progress: number }[] };
type Schedule = { remaining_hours: number; available_hours: number; at_risk: boolean; projected_finish: string; warning: string | null; sessions: { task_id: number; title: string; skill: string; date: string; minutes: number }[] };

export function GrowthPlannerPanel({ workspace }: { workspace?: GrowthWorkspace }) {
  const resource = useGrowthResource<Plan>(workspace?.latest_analysis_id ? `/learning/plans/by-analysis/${workspace.latest_analysis_id}` : null);
  const action = useGrowthAction();
  const saved = useGrowthResource<{ schedule: Schedule | null; study_days: number[] }>(resource.data ? `/growth/plans/${resource.data.id}/schedule` : null);
  const [hours, setHours] = useState(5);
  const [deadline, setDeadline] = useState(localDate());
  const [days, setDays] = useState([0, 2, 4]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  useEffect(() => { if (resource.data) { setHours(resource.data.hours_per_week); setDeadline(resource.data.target_date); } setSchedule(null); }, [resource.data]);
  useEffect(() => { if (saved.data) { setSchedule(current => current || saved.data!.schedule); setDays(saved.data.study_days); } }, [saved.data]);
  const submit = (event: FormEvent) => { event.preventDefault(); void action.run(async () => {
    const response = await api.post<Schedule>(`/growth/plans/${resource.data?.id}/replan`, { hours_per_week: hours, target_date: deadline, study_days: days });
    setSchedule(response.data); action.setMessage("Remaining tasks rescheduled. Completed work and your progress were preserved.");
  }); };
  const calendar = () => action.run(async () => { const response = await api.get("/growth/calendar", { responseType: "blob" }); downloadBlob(response.data, "skillsync-calendar.ics"); });
  return <div className="space-y-6"><GrowthCard title="Make your plan fit your week" description="Reschedule remaining work using your current progress and available study days. Tight deadlines produce a warning—not artificially shortened learning estimates.">
    {!workspace?.latest_analysis_id && <p className="text-sm text-muted-foreground">Analyse a target job first, then create its roadmap.</p>}
    <ResourceFeedback resource={resource} />
    {resource.data && <ResourceFeedback resource={saved} />}
    {resource.error && workspace?.latest_analysis_id && <Link className={`${growthSecondary} mt-3`} to={`/roadmap/${workspace.latest_analysis_id}`}>Create or open roadmap</Link>}
    {resource.data && saved.data && <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Hours per week<input required type="number" min={1} max={40} step={0.5} className={growthField} value={hours} onChange={e => setHours(Number(e.target.value))} /></label><label className="text-sm">Target date<input required type="date" min={localDate()} className={growthField} value={deadline} onChange={e => setDeadline(e.target.value)} /></label></div><fieldset><legend className="text-sm">Study days</legend><div className="mt-3 flex flex-wrap gap-2">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <label key={day} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${days.includes(index) ? "border-primary bg-primary/10" : "border-border"}`}><input type="checkbox" checked={days.includes(index)} onChange={() => setDays(current => current.includes(index) ? current.filter(d => d !== index) : [...current, index])} />{day}</label>)}</div></fieldset><div className="flex flex-wrap gap-3"><button className={growthButton} disabled={action.busy || !days.length}>Reschedule remaining work</button><button type="button" className={growthSecondary} disabled={action.busy} onClick={calendar}>Export deadlines to calendar</button><Link className={growthSecondary} to={`/roadmap/${workspace?.latest_analysis_id}`}>Open full roadmap</Link></div></form>}
    <GrowthFeedback {...action} />
  </GrowthCard>{schedule && <GrowthCard title="Your updated schedule" description={`Remaining effort: ${schedule.remaining_hours}h · Capacity before deadline: ${schedule.available_hours}h · Projected finish: ${schedule.projected_finish}`}>
    {schedule.warning && <p role="status" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{schedule.warning}</p>}
    <p className="mb-4 text-sm text-muted-foreground">Suggested sessions use up to 30 minutes each. Calendar export currently includes task deadlines and follow-ups, not timed study blocks.</p>
    <div className="space-y-3">{schedule.sessions.slice(0, 30).map((session, index) => <div key={`${session.task_id}-${index}`} className="flex flex-col justify-between gap-2 rounded-xl border border-border p-4 sm:flex-row"><div><p className="font-medium">{session.skill}</p><p className="mt-1 text-sm text-muted-foreground">{session.title}</p></div><p className="shrink-0 text-sm">{session.date} · {session.minutes} min</p></div>)}{schedule.sessions.length > 30 && <p className="text-sm text-muted-foreground">Showing the first 30 sessions of {schedule.sessions.length}. All task deadlines are saved in your roadmap.</p>}{!schedule.sessions.length && <p className="text-sm text-muted-foreground">All tasks are complete. No remaining work to schedule.</p>}</div>
  </GrowthCard>}</div>;
}

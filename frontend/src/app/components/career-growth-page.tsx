import { useSearchParams, Link } from "react-router-dom";
import { Award, CalendarDays, BriefcaseBusiness, MessagesSquare, Share2, Users } from "lucide-react";
import { ResourceFeedback, growthField, growthSecondary, useGrowthResource } from "./growth-ui";
import { SkillAssessmentsPanel } from "./skill-assessments-panel";
import { GrowthPlannerPanel, type GrowthWorkspace } from "./growth-planner-panel";
import { GrowthJobsPanel } from "./growth-jobs-panel";
import { GrowthContactsPanel } from "./growth-contacts-panel";
import { GrowthInterviewPanel } from "./growth-interview-panel";
import { GrowthPassportPanel } from "./growth-passport-panel";

const tabs = [{ id: "assessments", label: "Skill checks", icon: Award }, { id: "planner", label: "Weekly planner", icon: CalendarDays }, { id: "jobs", label: "Find & capture jobs", icon: BriefcaseBusiness }, { id: "interview", label: "Mock interviews", icon: MessagesSquare }, { id: "passport", label: "Skills Passport", icon: Share2 }, { id: "contacts", label: "Contacts & reminders", icon: Users }];

export function CareerGrowthPage() {
  const [params, setParams] = useSearchParams();
  const workspaces = useGrowthResource<GrowthWorkspace[]>("/workspaces");
  const tab = tabs.some(t => t.id === params.get("tab")) ? params.get("tab")! : "assessments";
  const workspace = workspaces.data?.find(w => String(w.id) === params.get("workspace")) || workspaces.data?.[0];
  const needsWorkspace = ["planner", "interview", "contacts"].includes(tab);
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">From learning to demonstrated skills</p><h1 className="mt-2 text-3xl font-medium tracking-tight">Career Growth</h1><p className="mt-3 max-w-3xl text-muted-foreground">Assess your knowledge, make progress fit your week, and share evidence you can stand behind.</p></div><Link to="/career" className={`${growthSecondary} shrink-0 self-start`}>Career Hub</Link></div>
    <nav aria-label="Career Growth sections" className="mb-6 flex flex-wrap gap-2">{tabs.map(({ id, label, icon: Icon }) => <Link key={id} to={`?tab=${id}${workspace ? `&workspace=${workspace.id}` : ""}`} aria-current={tab === id ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon className="size-4 shrink-0" />{label}</Link>)}</nav>
    {needsWorkspace && <div className="mb-6 rounded-xl border border-border bg-card p-4"><label className="block max-w-xl text-sm">Target-job workspace<select className={growthField} value={workspace?.id || ""} onChange={e => setParams({ tab, workspace: e.target.value })}><option value="" disabled>Select a target job</option>{workspaces.data?.map(w => <option key={w.id} value={w.id}>{w.title}{w.company ? ` · ${w.company}` : ""}</option>)}</select></label><ResourceFeedback resource={workspaces} />{workspaces.data && !workspaces.data.length && <Link to="/upload" className={`${growthSecondary} mt-3`}>Create a target job</Link>}</div>}
    {tab === "assessments" && <SkillAssessmentsPanel />}{tab === "planner" && <GrowthPlannerPanel key={workspace?.id} workspace={workspace} />}{tab === "jobs" && <GrowthJobsPanel onSaved={workspaces.reload} />}{tab === "interview" && <GrowthInterviewPanel key={workspace?.id} workspace={workspace} />}{tab === "passport" && <GrowthPassportPanel />}{tab === "contacts" && <GrowthContactsPanel key={workspace?.id} workspace={workspace} />}
  </main>;
}

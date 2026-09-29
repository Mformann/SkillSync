import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  TrendingUp, Upload, Target, BookOpen, ArrowRight, BarChart3, 
  CheckCircle2, AlertCircle, Calendar, LogOut, Loader2,
  Sparkles, Check, ChevronRight, Briefcase
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";

// --- Types ---
interface UserProfile {
  id: string;
  email: string;
  name: string;
}

interface ResumeData {
  id: number;
  filename: string;
  created_at: string;
  score?: number;
}

interface Goal {
  id: string;
  text: string;
  completed: boolean;
  progress: number;
}

interface GrowthSkill {
  name: string;
  status: "possessed" | "in_progress" | "gap" | "completed";
  progress: number;
  category?: string;
  priority?: string;
  estimatedHours?: number;
  taskId?: number;
}

export function DashboardPage() {
  const navigate = useNavigate();
  
  // --- State ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]); // For the Graph
  const [goals, setGoals] = useState<Goal[]>([]); // For Weekly Goals
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Skill Growth Tracker State
  const [targetJobRole, setTargetJobRole] = useState<string>("");
  const [targetCompany, setTargetCompany] = useState<string>("");
  const [growthSkills, setGrowthSkills] = useState<GrowthSkill[]>([]);
  const [growthFilter, setGrowthFilter] = useState<"all" | "in_progress" | "gaps" | "possessed">("all");

  // --- Computed Stats (Default 0) ---
  const [stats, setStats] = useState([
    { label: "Latest Score", value: "0", icon: Target, color: "text-primary", bgColor: "bg-primary/10", trend: "N/A" },
    { label: "Total Resumes", value: "0", icon: BarChart3, color: "text-cyan-500", bgColor: "bg-cyan-500/10", trend: "Total" },
    { label: "Avg Score", value: "0", icon: AlertCircle, color: "text-amber-500", bgColor: "bg-amber-500/10", trend: "Avg" },
    { label: "Analysis Done", value: "0", icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/10", trend: "Completed" },
  ]);

  // --- Logic ---
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError("");

        // 1. Fetch User from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/login"); return; }
        const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        if (userError) throw userError;
        
        if (supabaseUser) {
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            name: supabaseUser.user_metadata?.full_name || supabaseUser.email || 'User'
          });
        }

        // 2. Fetch Resumes
        const resumeRes = await api.get("/resume/all", { signal: controller.signal });
        if (!active) return;
        const resumeList = resumeRes.data || [];
        setResumes(resumeList);

        // 3. Process Chart Data (Sort Oldest to Newest)
        if (resumeList.length > 0) {
            const sortedResumes = [...resumeList].sort((a: any, b: any) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            // Map to Chart Format
            const newChartData = sortedResumes.map((r: any) => ({
                date: new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                score: r.score || 0
            }));
            setChartData(newChartData);

            // Process Stats
            const total = resumeList.length;
            const scores = resumeList.map((r: any) => r.score || 0);
            const avgScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / total);
            const latestScore = scores[0] || 0; // Since API returns newest first

            setStats([
                { label: "Latest Score", value: `${latestScore}`, icon: Target, color: "text-primary", bgColor: "bg-primary/10", trend: "New" },
                { label: "Total Resumes", value: `${total}`, icon: BarChart3, color: "text-cyan-500", bgColor: "bg-cyan-500/10", trend: "Total" },
                { label: "Avg Score", value: `${avgScore}`, icon: AlertCircle, color: "text-amber-500", bgColor: "bg-amber-500/10", trend: "Avg" },
                { label: "Analysis Done", value: `${total}`, icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/10", trend: "Completed" },
            ]);
        }

        // 4. Fetch Goals (From Gap Report)
        try {
            const gapRes = await api.get("/resume/gap-report/latest", { signal: controller.signal });
            if (!active) return;
            
            // Transform "Critical Gaps" into "Goals"
            if (gapRes.data && gapRes.data.gapAnalysis) {
                const newGoals = gapRes.data.gapAnalysis
                    .slice(0, 3) // Take top 3 gaps
                    .map((gap: any, index: number) => ({
                        id: `goal-${index}`,
                        text: `Learn ${gap.skill}`, // e.g., "Learn Docker"
                        completed: false,
                        progress: 0
                    }));
                setGoals(newGoals);
            }
        } catch {
            if (!active) return;
            setGoals([{ id: "default", text: "Upload resume to generate goals", completed: false, progress: 0 }]);
        }

        // 5. Fetch Skill Growth Tracker Data (Latest Explainable Analysis & Learning Plan)
        try {
          const [explainableRes, planRes] = await Promise.allSettled([
            api.get("/resume/analysis/latest/explainable", { signal: controller.signal }),
            api.get("/learning/plans/latest", { signal: controller.signal })
          ]);
          if (!active) return;

          const taskMap = new Map<string, { progress: number; status: string; estimatedHours: number; taskId: number }>();
          if (planRes.status === "fulfilled" && planRes.value.data?.tasks) {
            for (const task of planRes.value.data.tasks) {
              taskMap.set(task.skill.toLowerCase(), {
                progress: task.progress || 0,
                status: task.status,
                estimatedHours: task.estimated_hours,
                taskId: task.id,
              });
            }
          }

          if (explainableRes.status === "fulfilled" && explainableRes.value.data?.result) {
            const exp = explainableRes.value.data;
            setTargetJobRole(exp.context?.job_title || exp.result.summary || "Target Role");
            setTargetCompany(exp.context?.company || "");

            const requirements = new Map<string, { category?: string; priority?: string }>(
              exp.result.requirements.map((r: any) => [r.name.toLowerCase(), r])
            );
            const skillList: GrowthSkill[] = [];

            for (const match of exp.result.matches) {
              const req = requirements.get(match.requirement_name.toLowerCase());
              const skillLower = match.requirement_name.toLowerCase();
              const planTask = taskMap.get(skillLower);

              const isPossessed = ["strong_match", "partial_match", "transferable"].includes(match.status);

              let status: GrowthSkill["status"] = isPossessed ? "possessed" : "gap";
              let progress = isPossessed ? 100 : 0;

              if (planTask) {
                if (planTask.progress === 100 || planTask.status === "completed") {
                  status = "completed";
                  progress = 100;
                } else if (planTask.progress > 0) {
                  status = "in_progress";
                  progress = planTask.progress;
                }
              }

              skillList.push({
                name: match.requirement_name,
                status,
                progress,
                category: req?.category || "technical_skill",
                priority: req?.priority || "required",
                estimatedHours: planTask?.estimatedHours,
                taskId: planTask?.taskId,
              });
            }

            setGrowthSkills(skillList);
          }
        } catch {
          // Core resume data remains usable when optional growth data is unavailable.
        }

      } catch (error) {
        if (!active || axios.isCancel(error)) return;
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            setLoadError("Your session couldn't be verified by the API. Retry, or sign in again. If this continues, check the backend Supabase configuration.");
        } else {
            setLoadError("We couldn't load your dashboard. Check your connection and that the API is running, then retry.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; controller.abort(); };
  }, [navigate, retryCount]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login", { replace: true });
    } catch {
      setLoadError("We couldn't sign you out. Check your connection and try again.");
    }
  };

  const toggleGoal = (id: string) => {
    setGoals(goals.map(g => 
        g.id === id ? { ...g, completed: !g.completed, progress: !g.completed ? 100 : 0 } : g
    ));
  };

  const quickActions = [
    { title: "Upload New Resume", description: "Analyze your latest resume", icon: Upload, to: "/upload", color: "primary" },
    { title: "View Analysis", description: "Check your skill breakdown", icon: TrendingUp, to: "/analysis", color: "cyan" },
    { title: "Learning Roadmap", description: "Follow your personalized path", icon: BookOpen, to: "/roadmap", color: "blue" },
  ];

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  // Empty State
  if (loadError) {
    return <main className="mx-auto max-w-xl px-4 py-12"><section className="rounded-2xl border border-border bg-card p-6"><h1 className="mb-3 text-2xl">Dashboard unavailable</h1><p role="alert" className="text-destructive">{loadError}</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => setRetryCount(count => count + 1)} className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring">Retry</button><button type="button" onClick={handleLogout} className="min-h-11 rounded-lg border border-input px-4 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">Sign in again</button></div></section></main>;
  }
  if (resumes.length === 0) {
      return (
        <div className="flex h-[80vh] flex-col items-center justify-center text-center px-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <h1 className="mb-4 text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
                <p className="mb-8 text-muted-foreground">Upload your first resume and target job description to activate SkillSync.</p>
                <Link to="/upload" className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg hover:bg-primary/90">
                    Upload Your First Resume
                </Link>
            </motion.div>
        </div>
      );
  }

  const possessedCount = growthSkills.filter(s => s.status === "possessed" || s.status === "completed").length;
  const inProgressCount = growthSkills.filter(s => s.status === "in_progress").length;
  const gapCount = growthSkills.filter(s => s.status === "gap").length;
  const totalSkillsCount = growthSkills.length;

  const filteredGrowthSkills = growthSkills.filter(skill => {
    if (growthFilter === "in_progress") return skill.status === "in_progress";
    if (growthFilter === "gaps") return skill.status === "gap";
    if (growthFilter === "possessed") return skill.status === "possessed" || skill.status === "completed";
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome back, {user?.name.split(" ")[0]}!</h1>
            <p className="text-muted-foreground">Track your skill growth and career readiness</p>
          </div>
          <button onClick={handleLogout} className="group flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-destructive">
            <LogOut className="size-4" />
            <span>Log out</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:scale-105 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{stat.value}</p>
                  <div className="mt-2 flex items-center gap-1 text-sm text-green-500">
                    <TrendingUp className="size-3" />
                    <span>{stat.trend}</span>
                  </div>
                </div>
                <div className={`flex size-12 items-center justify-center rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`size-6 ${stat.color}`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 🚀 SKILL GROWTH TRACKER (Main Feature) */}
            {growthSkills.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="size-4" />
                      </div>
                      <h2 className="text-xl font-bold tracking-tight">Skill Growth Tracker</h2>
                    </div>
                    {targetJobRole && (
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Briefcase className="size-3" />
                        <span>Target: <strong>{targetJobRole}</strong> {targetCompany ? `at ${targetCompany}` : ""}</span>
                      </p>
                    )}
                  </div>

                  <Link
                    to="/roadmap"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Open Learning Roadmap <ChevronRight className="size-3" />
                  </Link>
                </div>

                {/* Skill Counts Bar */}
                <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3 text-center">
                  <div className="rounded-lg bg-card p-2 shadow-xs">
                    <p className="text-[11px] font-medium text-muted-foreground">Possessed</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                      {possessedCount} <span className="text-xs font-normal text-muted-foreground">/ {totalSkillsCount}</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-card p-2 shadow-xs">
                    <p className="text-[11px] font-medium text-muted-foreground">In Learning</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{inProgressCount}</p>
                  </div>
                  <div className="rounded-lg bg-card p-2 shadow-xs">
                    <p className="text-[11px] font-medium text-muted-foreground">Gaps Left</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{gapCount}</p>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3 text-xs">
                  <button
                    onClick={() => setGrowthFilter("all")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${growthFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    All Skills ({totalSkillsCount})
                  </button>
                  <button
                    onClick={() => setGrowthFilter("in_progress")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${growthFilter === "in_progress" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    In Progress ({inProgressCount})
                  </button>
                  <button
                    onClick={() => setGrowthFilter("gaps")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${growthFilter === "gaps" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    Remaining Gaps ({gapCount})
                  </button>
                  <button
                    onClick={() => setGrowthFilter("possessed")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${growthFilter === "possessed" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    Possessed ({possessedCount})
                  </button>
                </div>

                {/* Skill List */}
                <div className="mt-4 space-y-2.5">
                  {filteredGrowthSkills.map((skill) => {
                    const isDone = skill.status === "possessed" || skill.status === "completed";
                    const isInProgress = skill.status === "in_progress";

                    return (
                      <div
                        key={skill.name}
                        className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 transition-all hover:bg-card sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${isDone ? "bg-green-500/10 text-green-600 dark:text-green-400" : isInProgress ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                            {isDone ? <Check className="size-4" /> : <Target className="size-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">{skill.name}</span>
                              {skill.priority === "required" && (
                                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {skill.category ? skill.category.replace("_", " ") : "Skill"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {isInProgress ? (
                            <div className="w-28 text-right">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Mastery</span>
                                <span className="font-semibold text-primary">{skill.progress}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                <div className="h-full bg-primary" style={{ width: `${skill.progress}%` }} />
                              </div>
                            </div>
                          ) : isDone ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                              <CheckCircle2 className="size-3.5" /> Verified
                            </span>
                          ) : (
                            <Link
                              to="/roadmap"
                              className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                              Start Task
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* ✅ Progress Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h2 className="mb-6 text-xl font-bold tracking-tight">Score History</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="date" stroke="currentColor" opacity={0.5} />
                  <YAxis domain={[0, 100]} stroke="currentColor" opacity={0.5} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      color: "var(--card-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Quick Actions */}
            <div>
              <h2 className="mb-4 text-xl font-bold tracking-tight">Quick Actions</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    to={action.to}
                    className="group block rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110">
                      <action.icon className="size-6 text-primary" />
                    </div>
                    <h3 className="mb-1 font-semibold">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    <div className="mt-4 flex items-center gap-1 text-sm text-primary">
                      Get started <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Weekly Goals */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Weekly Focus Goals</h2>
                <Calendar className="size-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-4">
                {goals.map((goal) => (
                  <div key={goal.id} onClick={() => toggleGoal(goal.id)} className="cursor-pointer space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className={goal.completed ? "line-through text-muted-foreground" : "text-foreground font-medium"}>
                        {goal.text}
                      </span>
                      {goal.completed && <CheckCircle2 className="size-4 text-green-500" />}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${goal.progress}%` }}
                        className={`h-full ${goal.completed ? "bg-green-500" : "bg-primary"}`}
                      />
                    </div>
                  </div>
                ))}
                {goals.length === 0 && <p className="text-sm text-muted-foreground">No goals set yet.</p>}
              </div>
            </motion.div>

            {/* Recent Uploaded Resumes */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-xl font-bold tracking-tight">Resume Activity</h2>
              <div className="space-y-4">
                {resumes.length > 0 ? resumes.slice(0, 5).map((activity, index) => (
                  <div key={activity.id} className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="mt-0.5 size-2 shrink-0 rounded-full bg-green-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{activity.filename}</p>
                      <p className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleDateString()}</p>
                    </div>
                    {index === 0 && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Latest</span>}
                  </div>
                )) : <p className="text-sm text-muted-foreground">No recent activity.</p>}
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}

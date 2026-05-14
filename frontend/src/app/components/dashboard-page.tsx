import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  TrendingUp, Upload, Target, BookOpen, ArrowRight, BarChart3, 
  CheckCircle2, AlertCircle, Calendar, LogOut, Loader2 
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import { supabase } from "../../lib/supabase";

// --- Types ---
interface UserProfile {
  id: number;
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function DashboardPage() {
  const navigate = useNavigate();
  
  // --- State ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]); // For the Graph
  const [goals, setGoals] = useState<Goal[]>([]); // For Weekly Goals
  const [loading, setLoading] = useState(true);

  // --- Computed Stats (Default 0) ---
  const [stats, setStats] = useState([
    { label: "Latest Score", value: "0", icon: Target, color: "text-primary", bgColor: "bg-primary/10", trend: "N/A" },
    { label: "Total Resumes", value: "0", icon: BarChart3, color: "text-cyan-500", bgColor: "bg-cyan-500/10", trend: "Total" },
    { label: "Avg Score", value: "0", icon: AlertCircle, color: "text-amber-500", bgColor: "bg-amber-500/10", trend: "Avg" },
    { label: "Analysis Done", value: "0", icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/10", trend: "Completed" },
  ]);

  // --- Logic ---
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }

      try {
        setLoading(true);

        // 1. Fetch User from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        const activeToken = session?.access_token || token;
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        
        if (supabaseUser) {
          setUser({
            id: supabaseUser.id as any,
            email: supabaseUser.email || '',
            name: supabaseUser.user_metadata?.full_name || supabaseUser.email || 'User'
          });
        }

        // 2. Fetch Resumes
        const resumeRes = await axios.get(`${API_BASE_URL}/resume/all`, {
          headers: { "Authorization": `Bearer ${activeToken}` }
        });
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
            const gapRes = await axios.get(`${API_BASE_URL}/resume/gap-report/latest`, {
                headers: { "Authorization": `Bearer ${activeToken}` }
            });
            
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
        } catch (gapErr) {
            // If no gap report exists, show a default goal
            setGoals([{ id: "default", text: "Upload resume to generate goals", completed: false, progress: 0 }]);
        }

      } catch (error) {
        console.error("Dashboard Error:", error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            localStorage.removeItem("token");
            navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const toggleGoal = (id: string) => {
    setGoals(goals.map(g => 
        g.id === id ? { ...g, completed: !g.completed, progress: !g.completed ? 100 : 0 } : g
    ));
  };

  const quickActions = [
    { title: "Upload New Resume", description: "Analyze your latest resume", icon: Upload, to: "/upload", color: "primary" },
    { title: "View Analysis", description: "Check your skill breakdown", icon: TrendingUp, to: "/analysis/latest", color: "cyan" },
    { title: "Learning Roadmap", description: "Follow your personalized path", icon: BookOpen, to: "/roadmap/latest", color: "purple" },
  ];

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  // Empty State
  if (resumes.length === 0) {
      return (
        <div className="flex h-[80vh] flex-col items-center justify-center text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <h1 className="mb-4 text-3xl font-bold">Welcome, {user?.name}!</h1>
                <p className="mb-8 text-muted-foreground">You haven't uploaded a resume yet.</p>
                <Link to="/upload" className="rounded-lg bg-primary px-6 py-3 text-white shadow-lg hover:bg-primary/90">
                    Upload Your First Resume
                </Link>
            </motion.div>
        </div>
      );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="mb-2 text-3xl tracking-tight">Welcome back, {user?.name.split(" ")[0]}!</h1>
            <p className="text-muted-foreground">Here's an overview of your career progress</p>
          </div>
          <button onClick={handleLogout} className="group flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-red-500">
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
                  <p className="mt-2 text-3xl tracking-tight">{stat.value}</p>
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
            
            {/* ✅ REAL Progress Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h2 className="mb-6 text-xl">Progress Over Time</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="date" stroke="currentColor" opacity={0.5} />
                  <YAxis domain={[0, 100]} stroke="currentColor" opacity={0.5} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Quick Actions */}
            <div>
              <h2 className="mb-4 text-xl">Quick Actions</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quickActions.map((action, index) => (
                  <Link
                    key={action.title}
                    to={action.to}
                    className="group block rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className={`mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-${action.color}-500/10 transition-transform group-hover:scale-110`}>
                      <action.icon className={`size-6 text-${action.color}-500`} />
                    </div>
                    <h3 className="mb-1">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    <div className="mt-4 flex items-center gap-1 text-sm text-primary">
                      Get started <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            
            {/* Latest Skill Match Bar */}
            <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-4 text-xl">Latest Skill Match</h2>
                <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Overall Skill Match</span>
                    <span className="text-primary">{stats[0].value}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats[0].value}%` }}
                        transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary to-primary/80"
                    />
                    </div>
                </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* ✅ REAL Weekly Goals (From Gap Report) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl">Weekly Goals</h2>
                <Calendar className="size-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-4">
                {goals.map((goal, index) => (
                  <div key={goal.id} onClick={() => toggleGoal(goal.id)} className="cursor-pointer space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className={goal.completed ? "line-through text-muted-foreground" : ""}>
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

            {/* Recent Activity */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-xl">Recent Activity</h2>
              <div className="space-y-4">
                {resumes.length > 0 ? resumes.slice(0, 5).map((activity, index) => (
                  <div key={activity.id} className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="mt-0.5 size-2 shrink-0 rounded-full bg-green-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{activity.filename}</p>
                      <p className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleDateString()}</p>
                    </div>
                    {index === 0 && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Latest</span>}
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
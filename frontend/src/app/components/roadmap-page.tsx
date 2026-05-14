import axios from "axios";
import { motion } from "motion/react";
import { BookOpen, CheckCircle2, ChevronRight, Flag, Layout, Loader2, Map, Milestone } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// ✅ Type Definition matches Backend Schema
type RoadmapData = {
  overviewStats: { label: string; value: string }[];
  overallProgress: { percent: number };
  roadmap: {
    phase: string;
    title: string;
    duration: string;
    status: "completed" | "in-progress" | "pending";
    progress: number;
    skills: string[];
    milestones: string[];
  }[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function RoadmapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRoadmap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }
      
      try {
        setLoading(true);
        const endpoint = id 
          ? `${API_BASE_URL}/resume/roadmap/${id}` 
          : `${API_BASE_URL}/resume/roadmap/latest`;

        const response = await axios.get<RoadmapData>(endpoint, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        setData(response.data);
      } catch (err: any) {
        console.error("Roadmap fetch error:", err);
        setError("Could not load roadmap. Please upload a resume first.");
      } finally {
        setLoading(false);
      }
    };

    fetchRoadmap();
  }, [id, navigate]);

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="size-10 animate-spin text-primary" />
    </div>
  );

  if (error || !data) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      <Map className="size-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">No Roadmap Found</h2>
      <p className="text-muted-foreground">{error}</p>
      <button onClick={() => navigate("/upload")} className="mt-4 rounded-lg bg-primary px-6 py-2 text-primary-foreground">
        Generate Roadmap
      </button>
    </div>
  );

  const { overviewStats, overallProgress, roadmap } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Learning Roadmap</h1>
            <p className="text-muted-foreground">Your personalized path to mastering missing skills.</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
            <div className="text-sm font-medium">Overall Progress</div>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${overallProgress.percent}%` }} />
            </div>
            <span className="font-bold text-primary">{overallProgress.percent}%</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {overviewStats.map((stat, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 text-center">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {roadmap.map((phase, idx) => (
            <div key={idx} className="relative flex gap-6">
              {/* Timeline Line */}
              <div className="flex flex-col items-center">
                <div className={`flex size-8 items-center justify-center rounded-full border-2 ${
                  phase.status === 'completed' ? 'border-primary bg-primary text-primary-foreground' :
                  phase.status === 'in-progress' ? 'border-primary bg-background text-primary' :
                  'border-muted bg-background text-muted-foreground'
                }`}>
                  {phase.status === 'completed' ? <CheckCircle2 size={16} /> : <Flag size={16} />}
                </div>
                {idx !== roadmap.length - 1 && <div className="w-0.5 flex-1 bg-border/50" />}
              </div>

              {/* Card */}
              <div className={`flex-1 rounded-xl border p-6 transition-colors ${
                phase.status === 'in-progress' ? 'border-primary/50 bg-primary/5' : 'bg-card'
              }`}>
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <span className="mb-1 inline-block rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground border shadow-sm">
                      {phase.phase} • {phase.duration}
                    </span>
                    <h3 className="text-xl font-semibold">{phase.title}</h3>
                  </div>
                  {phase.status === 'in-progress' && (
                     <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                       <Loader2 className="size-3 animate-spin" /> In Progress
                     </span>
                  )}
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phase Completion</span>
                    <span className="font-medium">{phase.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${phase.progress}%` }} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <BookOpen className="size-4 text-blue-500" /> Focus Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {phase.skills.map(skill => (
                        <span key={skill} className="rounded-md border bg-background px-2 py-1 text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Milestone className="size-4 text-amber-500" /> Key Milestones
                    </h4>
                    <ul className="list-inside list-disc text-sm text-muted-foreground">
                      {phase.milestones.length > 0 ? phase.milestones.map((m, i) => <li key={i}>{m}</li>) : <li>Complete core modules</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </motion.div>
    </div>
  );
}
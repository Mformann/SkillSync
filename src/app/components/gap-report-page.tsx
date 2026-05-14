import axios from "axios";
import { AlertTriangle, CheckCircle2, Clock, Loader2, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "../../lib/supabase";

// ✅ Correct Type for Gap Report
type GapReportData = {
  summaryCards?: { label: string; value: string | number }[];
  gapAnalysis?: { skill: string; current: number; target: number; priority: string }[];
  strengthsVsGaps?: {
    strengths?: { skill: string; level: string; years: string }[];
    gaps?: { skill: string; impact: string; demandTrend: string }[];
  };
  targetRoles?: { title: string; matchScore: number; missingSkills: string[]; timeToReady: string }[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function GapReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<GapReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGapReport = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }
      
      try {
        setLoading(true);
        const endpoint = id 
          ? `${API_BASE_URL}/resume/gap-report/${id}` 
          : `${API_BASE_URL}/resume/gap-report/latest`;

        const response = await axios.get<GapReportData>(endpoint, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        setData(response.data);
      } catch (err: any) {
        console.error("Gap Report Fetch Error:", err);
        setError("Failed to load gap report. Please upload a resume first.");
      } finally {
        setLoading(false);
      }
    };

    fetchGapReport();
  }, [id, navigate]);

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="size-10 animate-spin text-primary" />
    </div>
  );

  if (error || !data) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="size-12 text-amber-500" />
      <h2 className="text-2xl font-semibold">No Gap Report Found</h2>
      <p className="text-muted-foreground">{error}</p>
      <button onClick={() => navigate("/upload")} className="mt-4 rounded-lg bg-primary px-6 py-2 text-primary-foreground">
        Upload Resume
      </button>
    </div>
  );

  // Safety Defaults
  const summaryCards = data.summaryCards || [];
  const gapAnalysis = data.gapAnalysis || [];
  const strengths = data.strengthsVsGaps?.strengths || [];
  const gaps = data.strengthsVsGaps?.gaps || [];
  const targetRoles = data.targetRoles || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Skill Gap Report</h1>
          <p className="text-muted-foreground">Detailed analysis of missing skills and learning priorities.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {summaryCards.map((card, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Gap Analysis Chart */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-6 text-xl font-semibold">Priority Gap Analysis</h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapAnalysis} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="skill" type="category" width={100} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="current" name="Current Level" stackId="a" fill="#94a3b8" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="target" name="Target Level" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Target Roles */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Target Roles</h2>
            <div className="space-y-6">
              {targetRoles.map((role, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-secondary/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{role.title}</h3>
                    <span className="text-sm font-bold text-primary">{role.matchScore}% Match</span>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                      <span>Missing: {role.missingSkills?.join(", ") || "None"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-blue-500" />
                      <span>Est. Time: {role.timeToReady}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Strengths vs Gaps Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Strengths */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle2 className="text-green-500" />
              <h2 className="text-xl font-semibold">Verified Strengths</h2>
            </div>
            <div className="space-y-4">
              {strengths.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{item.skill}</p>
                    <p className="text-sm text-muted-foreground">{item.years} experience</p>
                  </div>
                  <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500">
                    {item.level}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gaps */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-red-500" />
              <h2 className="text-xl font-semibold">Critical Gaps</h2>
            </div>
            <div className="space-y-4">
              {gaps.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{item.skill}</p>
                    <p className="text-sm text-muted-foreground">Demand: {item.demandTrend}</p>
                  </div>
                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500">
                    {item.impact} Impact
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
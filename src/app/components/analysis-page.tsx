import axios from "axios";
import "axios";
import { motion } from "motion/react";
import { TrendingUp, Download, Share2, CheckCircle2, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { useEffect, useState } from "react";

type AnalysisData = {
  skillDistribution: { name: string; value: number }[];
  topSkills: { skill: string; level: number }[];
  competencyData: { category: string; score: number }[];
  skillCategories: { title: string; icon: any; color: string; bgColor: string; skills: string[] }[];
};

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";
if (!((import.meta as any).env?.VITE_API_BASE_URL)) {
  console.warn("VITE_API_BASE_URL not set — falling back to http://localhost:8000 for local development.");
}

export function AnalysisPage() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await axios.get<AnalysisData>(`${API_BASE_URL}/analysis/skill-gap-analysis`);
        setAnalysisData(response.data);
      } catch (error) {
        console.error("Failed to fetch analysis data:", error);
      }
    };

    fetchAnalysis();
  }, []);

  if (!analysisData) {
    return <div>Loading analysis...</div>;
  }

  const { skillDistribution, topSkills, competencyData, skillCategories } = analysisData;

  const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981"];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="mb-2 text-3xl tracking-tight">Skill Analysis</h1>
            <p className="text-muted-foreground">Comprehensive breakdown of your resume and skills</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent">
              <Share2 className="size-4" />
              Share
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-all hover:bg-primary/90">
              <Download className="size-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Overall Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-purple-500/10 p-8"
        >
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Overall Match Score</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl tracking-tight">78</p>
                <p className="text-2xl text-muted-foreground">/ 100</p>
              </div>
              <div className="mt-2 flex items-center gap-1 text-sm text-green-500">
                <TrendingUp className="size-4" />
                <span>+5% from last analysis</span>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Total Skills Identified</p>
              <p className="text-4xl tracking-tight">24</p>
              <p className="mt-2 text-sm text-muted-foreground">Across 6 categories</p>
            </div>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Resume Strength</p>
              <p className="text-4xl tracking-tight">Good</p>
              <p className="mt-2 text-sm text-muted-foreground">Well-structured content</p>
            </div>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Job Match Rate</p>
              <p className="text-4xl tracking-tight">82%</p>
              <p className="mt-2 text-sm text-muted-foreground">For target roles</p>
            </div>
          </div>
        </motion.div>

        {/* Charts Grid */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Skill Distribution Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <h2 className="mb-6 text-xl">Skill Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={skillDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {skillDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Skills Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <h2 className="mb-6 text-xl">Top Skills Proficiency</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSkills} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis type="number" domain={[0, 100]} stroke="currentColor" opacity={0.5} />
                <YAxis dataKey="skill" type="category" width={100} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="level" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Competency Radar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6 lg:col-span-2"
          >
            <h2 className="mb-6 text-xl">Competency Overview</h2>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={competencyData}>
                <PolarGrid stroke="currentColor" opacity={0.2} />
                <PolarAngleAxis dataKey="category" stroke="currentColor" opacity={0.5} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="currentColor" opacity={0.5} />
                <Radar name="Your Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Skill Categories */}
        <div className="grid gap-6 lg:grid-cols-3">
          {skillCategories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-lg ${category.bgColor}`}>
                  <category.icon className={`size-5 ${category.color}`} />
                </div>
                <h3 className="text-lg">{category.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-8 rounded-xl border border-border bg-card p-6"
        >
          <h2 className="mb-4 text-xl">Key Recommendations</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h4 className="mb-1">Leverage Your Strengths</h4>
                <p className="text-sm text-muted-foreground">
                  Your frontend development skills are excellent. Consider highlighting these in your resume summary.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-amber-500/5 p-4">
              <TrendingUp className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div>
                <h4 className="mb-1">Focus on Backend Skills</h4>
                <p className="text-sm text-muted-foreground">
                  Improving your backend and DevOps skills will make you a more well-rounded full-stack developer.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-red-500/5 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
              <div>
                <h4 className="mb-1">Address Critical Gaps</h4>
                <p className="text-sm text-muted-foreground">
                  Modern development roles often require container orchestration and cloud deployment experience.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

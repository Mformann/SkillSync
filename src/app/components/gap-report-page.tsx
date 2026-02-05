import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Target, TrendingUp, BookOpen, Clock, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function GapReportPage() {
  const gapAnalysis = [
    { skill: "Kubernetes", current: 20, target: 85, priority: "High" },
    { skill: "GraphQL", current: 30, target: 80, priority: "High" },
    { skill: "CI/CD", current: 40, target: 85, priority: "Medium" },
    { skill: "Microservices", current: 35, target: 80, priority: "High" },
    { skill: "AWS", current: 55, target: 90, priority: "Medium" },
    { skill: "Docker", current: 60, target: 90, priority: "Low" },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "#ef4444";
      case "Medium":
        return "#f59e0b";
      case "Low":
        return "#10b981";
      default:
        return "#6366f1";
    }
  };

  const targetRoles = [
    {
      title: "Full Stack Developer",
      matchScore: 78,
      missingSkills: ["Kubernetes", "GraphQL", "Microservices"],
      timeToReady: "3-4 months",
    },
    {
      title: "Senior Frontend Developer",
      matchScore: 92,
      missingSkills: ["Advanced TypeScript", "Testing"],
      timeToReady: "1-2 months",
    },
    {
      title: "DevOps Engineer",
      matchScore: 45,
      missingSkills: ["Kubernetes", "Terraform", "Jenkins", "CI/CD"],
      timeToReady: "6-8 months",
    },
  ];

  const strengthsVsGaps = {
    strengths: [
      { skill: "JavaScript", level: "Expert", years: "5+" },
      { skill: "React", level: "Expert", years: "4+" },
      { skill: "TypeScript", level: "Advanced", years: "3+" },
      { skill: "Node.js", level: "Advanced", years: "3+" },
      { skill: "HTML/CSS", level: "Expert", years: "5+" },
    ],
    gaps: [
      { skill: "Kubernetes", impact: "High", demandTrend: "Growing" },
      { skill: "GraphQL", impact: "High", demandTrend: "Growing" },
      { skill: "Microservices", impact: "High", demandTrend: "Stable" },
      { skill: "CI/CD", impact: "Medium", demandTrend: "Stable" },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl tracking-tight">Skill Gap Report</h1>
          <p className="text-muted-foreground">
            Identify what's holding you back and what you need to learn next
          </p>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle2 className="size-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">Strong Skills</p>
            <p className="mt-1 text-3xl tracking-tight">16</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="size-5 text-red-500" />
            </div>
            <p className="text-sm text-muted-foreground">Skill Gaps</p>
            <p className="mt-1 text-3xl tracking-tight">8</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Target className="size-5 text-amber-500" />
            </div>
            <p className="text-sm text-muted-foreground">High Priority</p>
            <p className="mt-1 text-3xl tracking-tight">3</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="size-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Est. Learning Time</p>
            <p className="mt-1 text-3xl tracking-tight">3-4m</p>
          </motion.div>
        </div>

        {/* Gap Analysis Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8 rounded-xl border border-border bg-card p-6"
        >
          <h2 className="mb-6 text-xl">Skill Gap Analysis</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={gapAnalysis} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis type="number" domain={[0, 100]} stroke="currentColor" opacity={0.5} />
              <YAxis dataKey="skill" type="category" width={120} stroke="currentColor" opacity={0.5} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <Bar dataKey="current" name="Current Level" fill="#94a3b8" radius={[0, 4, 4, 0]} />
              <Bar dataKey="target" name="Target Level" radius={[0, 4, 4, 0]}>
                {gapAnalysis.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getPriorityColor(entry.priority)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-sm bg-[#94a3b8]" />
              <span className="text-muted-foreground">Current Level</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-sm bg-red-500" />
              <span className="text-muted-foreground">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-sm bg-amber-500" />
              <span className="text-muted-foreground">Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-sm bg-green-500" />
              <span className="text-muted-foreground">Low Priority</span>
            </div>
          </div>
        </motion.div>

        {/* Strengths vs Gaps */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="size-5 text-green-500" />
              </div>
              <h2 className="text-xl">Your Strengths</h2>
            </div>
            <div className="space-y-3">
              {strengthsVsGaps.strengths.map((strength, index) => (
                <motion.div
                  key={strength.skill}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05, duration: 0.3 }}
                  className="flex items-center justify-between rounded-lg bg-green-500/5 p-4"
                >
                  <div>
                    <p className="font-medium">{strength.skill}</p>
                    <p className="text-sm text-muted-foreground">{strength.years} experience</p>
                  </div>
                  <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-500">
                    {strength.level}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10">
                <AlertTriangle className="size-5 text-red-500" />
              </div>
              <h2 className="text-xl">Critical Gaps</h2>
            </div>
            <div className="space-y-3">
              {strengthsVsGaps.gaps.map((gap, index) => (
                <motion.div
                  key={gap.skill}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05, duration: 0.3 }}
                  className="flex items-center justify-between rounded-lg bg-red-500/5 p-4"
                >
                  <div>
                    <p className="font-medium">{gap.skill}</p>
                    <p className="text-sm text-muted-foreground">Trend: {gap.demandTrend}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      gap.impact === "High"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {gap.impact} Impact
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Target Role Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="mb-6 text-xl">Target Role Readiness</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {targetRoles.map((role, index) => (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h3 className="mb-4">{role.title}</h3>
                
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Match Score</span>
                    <span className="font-medium">{role.matchScore}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${role.matchScore}%` }}
                      transition={{ delay: 0.8 + index * 0.1, duration: 0.8, ease: "easeOut" }}
                      className={`h-full ${
                        role.matchScore >= 80
                          ? "bg-green-500"
                          : role.matchScore >= 60
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-sm text-muted-foreground">Missing Skills:</p>
                  <div className="flex flex-wrap gap-2">
                    {role.missingSkills.map((skill) => (
                      <span key={skill} className="rounded-md bg-secondary px-2 py-1 text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4" />
                    <span>{role.timeToReady}</span>
                  </div>
                  <button className="text-sm text-primary hover:underline">
                    View Path →
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Action CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-purple-500/10 p-8 text-center"
        >
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-8 text-primary" />
          </div>
          <h2 className="mb-2 text-2xl">Ready to close these gaps?</h2>
          <p className="mb-6 text-muted-foreground">
            Get a personalized learning roadmap tailored to your career goals
          </p>
          <a
            href="/roadmap"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
          >
            View Learning Roadmap
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}

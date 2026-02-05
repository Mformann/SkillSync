import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { TrendingUp, Upload, Target, BookOpen, ArrowRight, BarChart3, CheckCircle2, AlertCircle, Calendar, Zap, Trophy } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function DashboardPage() {
  const stats = [
    { label: "Skill Match", value: "78%", icon: Target, color: "text-primary", bgColor: "bg-primary/10", trend: "+5%" },
    { label: "Total Skills", value: "24", icon: BarChart3, color: "text-cyan-500", bgColor: "bg-cyan-500/10", trend: "+3" },
    { label: "Skill Gaps", value: "8", icon: AlertCircle, color: "text-amber-500", bgColor: "bg-amber-500/10", trend: "-2" },
    { label: "Strengths", value: "16", icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/10", trend: "+4" },
  ];

  // Mock progress data over time
  const progressData = [
    { month: "Jan", score: 65 },
    { month: "Feb", score: 68 },
    { month: "Mar", score: 71 },
    { month: "Apr", score: 74 },
    { month: "May", score: 76 },
    { month: "Jun", score: 78 },
  ];

  const recentActivity = [
    { action: "Resume uploaded", date: "2 hours ago", status: "completed" },
    { action: "Skill analysis generated", date: "2 hours ago", status: "completed" },
    { action: "Gap report created", date: "2 hours ago", status: "completed" },
    { action: "Learning roadmap ready", date: "2 hours ago", status: "new" },
  ];

  const quickActions = [
    {
      title: "Upload New Resume",
      description: "Analyze your latest resume",
      icon: Upload,
      to: "/upload",
      color: "primary",
    },
    {
      title: "View Analysis",
      description: "Check your skill breakdown",
      icon: TrendingUp,
      to: "/analysis",
      color: "cyan",
    },
    {
      title: "Learning Roadmap",
      description: "Follow your personalized path",
      icon: BookOpen,
      to: "/roadmap",
      color: "purple",
    },
  ];

  const weeklyGoals = [
    { goal: "Complete Docker fundamentals", progress: 100, total: 100, completed: true },
    { goal: "Study Kubernetes basics", progress: 45, total: 100, completed: false },
    { goal: "Build containerized app", progress: 30, total: 100, completed: false },
  ];

  const achievements = [
    { title: "First Upload", icon: Upload, unlocked: true },
    { title: "Skill Expert", icon: Trophy, unlocked: true },
    { title: "Fast Learner", icon: Zap, unlocked: false },
    { title: "Goal Crusher", icon: Target, unlocked: false },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl tracking-tight">Welcome back, John!</h1>
          <p className="text-muted-foreground">Here's an overview of your career progress</p>
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
                <motion.div 
                  className={`flex size-12 items-center justify-center rounded-lg ${stat.bgColor}`}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <stat.icon className={`size-6 ${stat.color}`} />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Progress Over Time Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h2 className="mb-6 text-xl">Progress Over Time</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="month" stroke="currentColor" opacity={0.5} />
                  <YAxis domain={[60, 85]} stroke="currentColor" opacity={0.5} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ fill: "#6366f1", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Quick Actions */}
            <div>
              <h2 className="mb-4 text-xl">Quick Actions</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={action.title}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.03, y: -4 }}
                    transition={{ delay: 0.2 + index * 0.05, duration: 0.3 }}
                  >
                    <Link
                      to={action.to}
                      className="group block rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <div className={`mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-${action.color}-500/10 transition-transform group-hover:scale-110`}>
                        <action.icon className={`size-6 text-${action.color}-500`} />
                      </div>
                      <h3 className="mb-1">{action.title}</h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                      <div className="mt-4 flex items-center gap-1 text-sm text-primary">
                        Get started
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Progress Overview */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-xl">Skill Categories Progress</h2>
              
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Overall Skill Match</span>
                    <span className="text-primary">78%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "78%" }}
                      transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary to-primary/80"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Technical Skills</span>
                    <span className="text-cyan-500">85%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "85%" }}
                      transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-500/80"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Soft Skills</span>
                    <span className="text-purple-500">72%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "72%" }}
                      transition={{ delay: 0.7, duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-500/80"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Industry Knowledge</span>
                    <span className="text-green-500">65%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "65%" }}
                      transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-green-500 to-green-500/80"
                    />
                  </div>
                </div>
              </div>

              <Link
                to="/analysis"
                className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm transition-colors hover:bg-accent"
              >
                View Detailed Analysis
                <ArrowRight className="size-4" />
              </Link>
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
                <h2 className="text-xl">Weekly Goals</h2>
                <Calendar className="size-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-4">
                {weeklyGoals.map((goal, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className={goal.completed ? "line-through text-muted-foreground" : ""}>
                        {goal.goal}
                      </span>
                      {goal.completed && (
                        <CheckCircle2 className="size-4 text-green-500" />
                      )}
                    </div>
                    {!goal.completed && (
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${goal.progress}%` }}
                          transition={{ delay: 0.5 + index * 0.1, duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-primary"
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-xl">Recent Activity</h2>
              
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                    className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className={`mt-0.5 size-2 shrink-0 rounded-full ${
                      activity.status === "new" ? "bg-primary" : "bg-green-500"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.date}</p>
                    </div>
                    {activity.status === "new" && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        New
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h2 className="mb-4 text-xl">Achievements</h2>
              
              <div className="grid grid-cols-2 gap-3">
                {achievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.title}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: achievement.unlocked ? 1.05 : 1 }}
                    transition={{ delay: 0.7 + index * 0.05, duration: 0.3 }}
                    className={`flex flex-col items-center gap-2 rounded-lg p-4 text-center ${
                      achievement.unlocked
                        ? "bg-gradient-to-br from-primary/10 to-purple-500/10"
                        : "bg-muted/50 opacity-50"
                    }`}
                  >
                    <div
                      className={`flex size-12 items-center justify-center rounded-full ${
                        achievement.unlocked ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <achievement.icon
                        className={`size-6 ${
                          achievement.unlocked ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <p className="text-xs">{achievement.title}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Tips Card */}
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 p-6">
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Target className="size-5 text-primary" />
              </div>
              <h3 className="mb-2">Pro Tip</h3>
              <p className="text-sm text-muted-foreground">
                Review your skill gap report to prioritize which skills to learn first for maximum career impact.
              </p>
              <Link
                to="/gap-report"
                className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Gap Report
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
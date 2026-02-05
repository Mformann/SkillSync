import { motion } from "motion/react";
import { BookOpen, CheckCircle2, Clock, PlayCircle, FileText, Video, Code, Award, ExternalLink, ChevronRight } from "lucide-react";
import { useState } from "react";

export function RoadmapPage() {
  const [activePhase, setActivePhase] = useState<number | null>(0);

  const roadmap = [
    {
      phase: "Phase 1",
      title: "Foundation Building",
      duration: "4-6 weeks",
      status: "in-progress",
      progress: 45,
      skills: ["Docker", "Container Basics", "DevOps Fundamentals"],
      milestones: [
        {
          title: "Docker Fundamentals",
          type: "course",
          duration: "8 hours",
          completed: true,
          resources: [
            { title: "Docker Crash Course", type: "video", platform: "YouTube", link: "#" },
            { title: "Docker Official Docs", type: "documentation", platform: "Docker", link: "#" },
          ],
        },
        {
          title: "Container Orchestration Intro",
          type: "course",
          duration: "6 hours",
          completed: true,
          resources: [
            { title: "Containers 101", type: "course", platform: "Udemy", link: "#" },
          ],
        },
        {
          title: "Build Your First Container App",
          type: "project",
          duration: "12 hours",
          completed: false,
          resources: [
            { title: "Project Tutorial", type: "article", platform: "Medium", link: "#" },
          ],
        },
      ],
    },
    {
      phase: "Phase 2",
      title: "Kubernetes Mastery",
      duration: "6-8 weeks",
      status: "upcoming",
      progress: 0,
      skills: ["Kubernetes", "K8s Deployment", "Service Mesh"],
      milestones: [
        {
          title: "Kubernetes Fundamentals",
          type: "course",
          duration: "15 hours",
          completed: false,
          resources: [
            { title: "Kubernetes for Developers", type: "course", platform: "Pluralsight", link: "#" },
            { title: "K8s Official Tutorial", type: "documentation", platform: "Kubernetes", link: "#" },
          ],
        },
        {
          title: "Deploy Microservices on K8s",
          type: "project",
          duration: "20 hours",
          completed: false,
          resources: [
            { title: "Microservices Architecture", type: "course", platform: "Coursera", link: "#" },
          ],
        },
        {
          title: "Kubernetes Certification",
          type: "certification",
          duration: "40 hours",
          completed: false,
          resources: [
            { title: "CKA Certification Prep", type: "course", platform: "Linux Foundation", link: "#" },
          ],
        },
      ],
    },
    {
      phase: "Phase 3",
      title: "Modern API Development",
      duration: "4-5 weeks",
      status: "upcoming",
      progress: 0,
      skills: ["GraphQL", "API Design", "Apollo Server"],
      milestones: [
        {
          title: "GraphQL Fundamentals",
          type: "course",
          duration: "10 hours",
          completed: false,
          resources: [
            { title: "GraphQL Complete Guide", type: "course", platform: "Udemy", link: "#" },
            { title: "GraphQL Official Docs", type: "documentation", platform: "GraphQL", link: "#" },
          ],
        },
        {
          title: "Build a GraphQL API",
          type: "project",
          duration: "15 hours",
          completed: false,
          resources: [
            { title: "Apollo Server Tutorial", type: "course", platform: "Apollo Docs", link: "#" },
          ],
        },
      ],
    },
    {
      phase: "Phase 4",
      title: "CI/CD & Automation",
      duration: "3-4 weeks",
      status: "upcoming",
      progress: 0,
      skills: ["GitHub Actions", "CI/CD Pipelines", "Testing Automation"],
      milestones: [
        {
          title: "CI/CD Fundamentals",
          type: "course",
          duration: "8 hours",
          completed: false,
          resources: [
            { title: "CI/CD Masterclass", type: "course", platform: "Udemy", link: "#" },
          ],
        },
        {
          title: "Setup Complete CI/CD Pipeline",
          type: "project",
          duration: "12 hours",
          completed: false,
          resources: [
            { title: "GitHub Actions Guide", type: "documentation", platform: "GitHub", link: "#" },
          ],
        },
      ],
    },
  ];

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "video":
        return Video;
      case "course":
        return PlayCircle;
      case "documentation":
        return FileText;
      case "article":
        return FileText;
      default:
        return BookOpen;
    }
  };

  const getMilestoneIcon = (type: string) => {
    switch (type) {
      case "course":
        return BookOpen;
      case "project":
        return Code;
      case "certification":
        return Award;
      default:
        return CheckCircle2;
    }
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
          <h1 className="mb-2 text-3xl tracking-tight">Your Learning Roadmap</h1>
          <p className="text-muted-foreground">
            A personalized path to achieve your career goals and close skill gaps
          </p>
        </div>

        {/* Overview Stats */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="size-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Total Duration</p>
            <p className="mt-1 text-3xl tracking-tight">17-23w</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle2 className="size-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="mt-1 text-3xl tracking-tight">2/11</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-cyan-500/10">
              <PlayCircle className="size-5 text-cyan-500" />
            </div>
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="mt-1 text-3xl tracking-tight">1</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Award className="size-5 text-purple-500" />
            </div>
            <p className="text-sm text-muted-foreground">Certifications</p>
            <p className="mt-1 text-3xl tracking-tight">1</p>
          </motion.div>
        </div>

        {/* Overall Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8 rounded-xl border border-border bg-card p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl">Overall Progress</h2>
            <span className="text-2xl">18%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "18%" }}
              transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-purple-500"
            />
          </div>
        </motion.div>

        {/* Roadmap Phases */}
        <div className="space-y-6">
          {roadmap.map((phase, phaseIndex) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + phaseIndex * 0.1, duration: 0.5 }}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              {/* Phase Header */}
              <button
                onClick={() => setActivePhase(activePhase === phaseIndex ? null : phaseIndex)}
                className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex size-12 items-center justify-center rounded-lg ${
                      phase.status === "in-progress"
                        ? "bg-primary/10"
                        : phase.status === "completed"
                        ? "bg-green-500/10"
                        : "bg-muted"
                    }`}
                  >
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="size-6 text-green-500" />
                    ) : (
                      <span
                        className={`text-lg ${
                          phase.status === "in-progress" ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {phaseIndex + 1}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center gap-3">
                      <h3 className="text-lg">{phase.title}</h3>
                      {phase.status === "in-progress" && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          In Progress
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="size-4" />
                        <span>{phase.duration}</span>
                      </div>
                      <div className="flex gap-2">
                        {phase.skills.map((skill) => (
                          <span key={skill} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {phase.progress > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${phase.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{phase.progress}%</span>
                    </div>
                  )}
                  <ChevronRight
                    className={`size-5 text-muted-foreground transition-transform ${
                      activePhase === phaseIndex ? "rotate-90" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Phase Content */}
              {activePhase === phaseIndex && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-border bg-muted/30 p-6"
                >
                  <div className="space-y-6">
                    {phase.milestones.map((milestone, milestoneIndex) => {
                      const MilestoneIcon = getMilestoneIcon(milestone.type);
                      return (
                        <div
                          key={milestoneIndex}
                          className="rounded-lg border border-border bg-card p-6"
                        >
                          <div className="mb-4 flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg ${
                                  milestone.completed ? "bg-green-500/10" : "bg-primary/10"
                                }`}
                              >
                                {milestone.completed ? (
                                  <CheckCircle2 className="size-5 text-green-500" />
                                ) : (
                                  <MilestoneIcon className="size-5 text-primary" />
                                )}
                              </div>
                              <div>
                                <h4 className="mb-1">{milestone.title}</h4>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span className="capitalize">{milestone.type}</span>
                                  <span>•</span>
                                  <span>{milestone.duration}</span>
                                </div>
                              </div>
                            </div>
                            {milestone.completed && (
                              <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-500">
                                Completed
                              </span>
                            )}
                          </div>

                          {/* Resources */}
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Recommended Resources:</p>
                            {milestone.resources.map((resource, resourceIndex) => {
                              const ResourceIcon = getResourceIcon(resource.type);
                              return (
                                <a
                                  key={resourceIndex}
                                  href={resource.link}
                                  className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary"
                                >
                                  <div className="flex items-center gap-3">
                                    <ResourceIcon className="size-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm">{resource.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {resource.platform}
                                      </p>
                                    </div>
                                  </div>
                                  <ExternalLink className="size-4 text-muted-foreground" />
                                </a>
                              );
                            })}
                          </div>

                          {!milestone.completed && (
                            <button className="mt-4 w-full rounded-lg bg-primary py-2 text-sm text-primary-foreground transition-all hover:bg-primary/90">
                              Start Learning
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Tips Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-8 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-purple-500/10 p-6"
        >
          <h3 className="mb-3">💡 Learning Tips</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Focus on one phase at a time for better retention</li>
            <li>• Build projects to apply what you learn</li>
            <li>• Join communities for support and networking</li>
            <li>• Track your progress and celebrate small wins</li>
          </ul>
        </motion.div>
      </motion.div>
    </div>
  );
}

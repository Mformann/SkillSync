import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Sparkles, Target, TrendingUp, CheckCircle2, ArrowRight, Zap, BarChart3, BookOpen } from "lucide-react";

// Reusable FeatureCard Component
function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
    >
      <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <Icon className="size-6" />
      </div>
      <h3 className="mb-2 text-xl">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </motion.div>
  );
}

// Reusable BenefitItem Component
function BenefitItem({ benefit }: { benefit: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex items-start gap-3"
    >
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
      <span>{benefit}</span>
    </motion.div>
  );
}

export function LandingPage() {
  const features = [
    {
      icon: Target,
      title: "AI-Powered Analysis",
      description: "Get instant insights on your skills and career readiness with advanced AI technology.",
    },
    {
      icon: TrendingUp,
      title: "Skill Gap Detection",
      description: "Identify exactly what skills you need to land your dream job.",
    },
    {
      icon: BookOpen,
      title: "Personalized Roadmap",
      description: "Receive a custom learning path tailored to your career goals.",
    },
    {
      icon: BarChart3,
      title: "Track Your Progress",
      description: "Monitor your skill development journey with visual analytics.",
    },
  ];

  const benefits = [
    "Upload your resume in seconds",
    "Get detailed skill analysis reports",
    "Compare with industry standards",
    "Personalized learning recommendations",
    "Track improvement over time",
    "Export professional reports",
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary"
            >
              <Sparkles className="size-4" />
              AI-Powered Career Analytics
            </motion.div>

            <h1 className="mb-6 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-5xl tracking-tight text-transparent sm:text-6xl lg:text-7xl">
              Unlock Your Career Potential
            </h1>

            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              Analyze your resume, discover skill gaps, and get a personalized roadmap to achieve your career goals.
              Join thousands of professionals leveling up their careers.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
              >
                Get Started Free
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-8 py-4 text-lg transition-all hover:bg-accent"
              >
                Sign In
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                Free forever
              </div>
            </div>
          </motion.div>

          {/* Hero Image/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mx-auto mt-16 max-w-5xl"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10" />
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
                <div className="flex size-full items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="size-6" />
                    <span className="text-lg">Dashboard Preview</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border bg-card/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl tracking-tight">Everything you need to succeed</h2>
            <p className="text-lg text-muted-foreground">
              Powerful features to help you understand and improve your career readiness
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="mb-6 text-4xl tracking-tight">
                Why choose <span className="text-primary">SkillSync</span>?
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Our AI-powered platform provides comprehensive analysis and actionable insights to help you stay
                competitive in today's job market.
              </p>

              <div className="space-y-4">
                {benefits.map((benefit) => (
                  <BenefitItem key={benefit} benefit={benefit} />
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-xl">
                <div className="space-y-4">
                  <div className="h-4 w-2/3 rounded-lg bg-muted" />
                  <div className="h-4 w-full rounded-lg bg-muted" />
                  <div className="h-4 w-5/6 rounded-lg bg-muted" />
                  <div className="mt-8 space-y-3">
                    <div className="h-20 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20" />
                    <div className="h-20 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20" />
                    <div className="h-20 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 -z-10 size-full rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 blur-2xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-gradient-to-br from-primary/10 via-background to-purple-500/10 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="mb-4 text-4xl tracking-tight">Ready to level up your career?</h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Join thousands of professionals who are already using SkillSync to advance their careers.
            </p>
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
              Start Your Journey
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <TrendingUp className="size-5" />
            <span>© 2026 SkillSync. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

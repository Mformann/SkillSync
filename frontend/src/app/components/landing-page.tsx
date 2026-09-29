import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileSearch,
  LockKeyhole,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
};

const features: Feature[] = [
  { icon: FileSearch, eyebrow: "Understand", title: "Explainable resume analysis", description: "See the requirement, the evidence found in your resume, and why each match was scored." },
  { icon: Target, eyebrow: "Prioritize", title: "Role-specific skill gaps", description: "Separate required gaps from nice-to-have skills so your next move is always clear." },
  { icon: BookOpenCheck, eyebrow: "Improve", title: "A roadmap you can finish", description: "Turn gaps into prerequisite-aware weekly tasks, projects, and evidence checkpoints." },
  { icon: WandSparkles, eyebrow: "Tailor", title: "Truth-grounded resume studio", description: "Adapt your resume for a role without inventing claims or losing the story behind your work." },
  { icon: BriefcaseBusiness, eyebrow: "Prepare", title: "Application and interview tools", description: "Build outreach, track applications, and practice answers grounded in the target role." },
  { icon: BarChart3, eyebrow: "Prove", title: "Readiness you can explain", description: "Bring match, learning, portfolio proof, and practice into one transparent progress view." },
];

const steps = [
  { number: "01", icon: Upload, title: "Add your target role", description: "Paste the job description and upload the resume you plan to submit." },
  { number: "02", icon: FileSearch, title: "Review the evidence", description: "Inspect every requirement, match, confidence level, and recommended action." },
  { number: "03", icon: RouteIcon, title: "Follow the next best step", description: "Work through a prioritized plan and turn progress into stronger application material." },
];

const trustPoints = [
  "Original resume files are processed in memory and are not retained",
  "External AI processing requires your explicit workspace consent",
  "Export your data or permanently delete your app data at any time",
];

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.42, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FeatureCard({ feature, featured = false }: { feature: Feature; featured?: boolean }) {
  const Icon = feature.icon;
  return (
    <Reveal className={featured ? "md:col-span-2" : ""}>
      <article className="group h-full rounded-3xl border border-border bg-card p-6 transition-colors duration-200 hover:border-primary/40 hover:bg-secondary/45 sm:p-7">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon className="size-5" aria-hidden="true" /></div>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{feature.eyebrow}</span>
        </div>
        <h3 className="text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">{feature.title}</h3>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">{feature.description}</p>
      </article>
    </Reveal>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -right-8 -top-8 hidden size-32 rounded-full border border-primary/20 bg-secondary lg:block" aria-hidden="true" />
      <div className="absolute -bottom-10 -left-10 hidden size-24 rounded-3xl bg-marketing-accent/10 lg:block" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_70px_-38px_rgba(14,116,144,0.32)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sample analysis</p><p className="mt-1 font-semibold text-card-foreground">Senior Product Designer</p></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"><CheckCircle2 className="size-3.5" aria-hidden="true" />Evidence ready</span>
        </div>
        <div className="grid gap-5 p-5 sm:p-6">
          <div className="rounded-2xl bg-marketing-surface p-5 dark:bg-secondary/60">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-medium text-muted-foreground">Career readiness</p><p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">78<span className="text-xl text-muted-foreground">/100</span></p></div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><TrendingUp className="size-5" aria-hidden="true" /></div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-label="Sample career readiness score" aria-valuenow={78} aria-valuemin={0} aria-valuemax={100}><div className="h-full w-[78%] rounded-full bg-primary" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Strong evidence</p>
              <div className="mt-3 flex flex-wrap gap-2">{["User research", "Prototyping", "Design systems"].map((skill) => <span key={skill} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{skill}</span>)}</div>
            </div>
            <div className="rounded-2xl border border-border p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next focus</p><p className="mt-3 text-sm font-semibold text-card-foreground">Quantify product impact</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Add one measurable outcome to your case study.</p></div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
            <div className="flex gap-3"><Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-sm font-semibold text-card-foreground">Your highest-impact next step</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Complete the analytics storytelling brief, then attach the finished project as evidence.</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="overflow-hidden bg-background text-foreground">
      <section className="relative border-b border-border" aria-labelledby="hero-heading">
        <div className="pointer-events-none absolute -left-32 top-24 size-72 rounded-full border border-primary/15 bg-secondary/70" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 bottom-10 size-56 rotate-12 rounded-[3rem] border border-marketing-accent/15 bg-marketing-accent/[0.06]" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24 xl:gap-20 xl:py-28">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-secondary px-3.5 py-2 text-sm font-semibold text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
              Career decisions, backed by evidence
            </div>
            <h1 id="hero-heading" className="mt-7 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
              Turn your resume into a career plan that <span className="text-primary">moves you forward.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              SkillSync connects the role you want with the experience you already have—then shows the gaps, evidence, and next actions behind every recommendation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/signup"
                className="group inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                Start with your target role
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-6 py-3 font-semibold text-card-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                See how it works
              </a>
            </div>
            <ul className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3" aria-label="Account benefits">
              {["No credit card", "Explainable results", "You control your data"].map((item) => (
                <li key={item} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-primary" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}>
            <ProductPreview />
          </motion.div>
        </div>
      </section>

      <section className="border-b border-border bg-card" aria-label="Product principles">
        <div className="mx-auto grid max-w-7xl divide-y divide-border px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
          {[
            ["One connected workspace", "Resume, role, roadmap, evidence, and applications stay in context."],
            ["Transparent by design", "Review the evidence and confidence behind every recommendation."],
            ["Progress over scores", "Turn insights into weekly actions you can complete and prove."],
          ].map(([title, copy]) => (
            <div key={title} className="py-7 md:px-7 md:first:pl-0 md:last:pr-0">
              <p className="font-semibold text-card-foreground">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-24 py-20 sm:py-24" aria-labelledby="features-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">From insight to evidence</p>
            <h2 id="features-heading" className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Everything you need to become a stronger candidate.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Not another one-off resume score. SkillSync keeps the full path from job description to confident application connected.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => <FeatureCard key={feature.title} feature={feature} featured={index === 0} />)}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-y border-border bg-marketing-strong py-20 text-white sm:py-24" aria-labelledby="workflow-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">A clearer workflow</p>
            <h2 id="workflow-heading" className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Three steps from uncertainty to a focused plan.</h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/15 bg-white/15 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.number} delay={index * 0.06}>
                  <article className="h-full bg-marketing-strong p-6 sm:p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-sky-100"><Icon className="size-5" aria-hidden="true" /></div>
                      <span className="font-mono text-sm text-sky-200">{step.number}</span>
                    </div>
                    <h3 className="mt-8 text-2xl font-semibold text-white">{step.title}</h3>
                    <p className="mt-3 text-base leading-7 text-sky-100/85">{step.description}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section id="privacy" className="scroll-mt-24 py-20 sm:py-24" aria-labelledby="privacy-heading">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <Reveal>
            <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="size-7" aria-hidden="true" /></div>
            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Privacy with a purpose</p>
            <h2 id="privacy-heading" className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Your career data stays under your control.</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">Use AI when it helps, understand when a fallback is used, and keep control over the information that powers your plan.</p>
          </Reveal>
          <Reveal className="rounded-[2rem] border border-border bg-card p-6 sm:p-8">
            <ul className="space-y-4">
              {trustPoints.map((point) => (
                <li key={point} className="flex gap-4 rounded-2xl bg-marketing-surface p-4 dark:bg-secondary/60 sm:p-5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary"><LockKeyhole className="size-4" aria-hidden="true" /></div>
                  <p className="pt-1 text-sm font-medium leading-6 text-card-foreground sm:text-base">{point}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8" aria-labelledby="cta-heading">
        <Reveal className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-primary-foreground sm:px-10 sm:py-16 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:px-14">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-100">Your next move starts here</p>
            <h2 id="cta-heading" className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Bring the role. We’ll help you build the proof.</h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-sky-100">Create a workspace, add your target job, and get a plan grounded in your real experience.</p>
          </div>
          <Link
            to="/signup"
            className="mt-8 inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-sky-900 transition-colors duration-200 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 lg:mt-0"
          >
            Create your free workspace
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Reveal>
      </section>

      <footer role="contentinfo" className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link
            to="/"
            aria-label="SkillSync home"
            className="inline-flex min-h-11 w-fit cursor-pointer items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src="/brand/skillsync-lockup-tagline.png"
              alt=""
              width={2172}
              height={724}
              loading="lazy"
              className="h-14 w-auto max-w-[168px] object-contain dark:invert dark:hue-rotate-180 sm:h-16 sm:max-w-[192px]"
            />
          </Link>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <a href="#features" className="cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Product</a>
            <a href="#how-it-works" className="cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">How it works</a>
            <a href="#privacy" className="cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacy approach</a>
            <Link to="/privacy-policy" className="cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacy policy</Link>
            <Link to="/terms" className="cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Terms</Link>
          </nav>
          <p className="text-sm text-muted-foreground">© 2026 SkillSync</p>
        </div>
      </footer>
    </main>
  );
}

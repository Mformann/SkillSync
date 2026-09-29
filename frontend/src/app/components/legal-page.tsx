import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  kind: "privacy" | "terms";
  eyebrow: string;
  title: string;
  summary: string;
  effectiveDate: string;
  sections: LegalSection[];
};

const pageMeta: Record<LegalPageProps["kind"], {
  icon: LucideIcon;
  note: string;
  alternatePath: string;
  alternateLabel: string;
}> = {
  privacy: {
    icon: ShieldCheck,
    note: "A plain-language explanation of what SkillSync processes, why it is used, and the choices available to you.",
    alternatePath: "/terms",
    alternateLabel: "Read the terms & conditions",
  },
  terms: {
    icon: Scale,
    note: "The ground rules for using SkillSync, including important limits around AI-generated career guidance.",
    alternatePath: "/privacy-policy",
    alternateLabel: "Read the privacy policy",
  },
};

export function LegalPage({ kind, eyebrow, title, summary, effectiveDate, sections }: LegalPageProps) {
  const meta = pageMeta[kind];
  const Icon = meta.icon;

  return (
    <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <Link
            to="/"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to SkillSync
          </Link>

          <div className="mt-8 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-secondary px-3.5 py-2 text-sm font-semibold text-primary">
                <Icon className="size-4" aria-hidden="true" />
                {eyebrow}
              </div>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl lg:text-6xl">{title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{summary}</p>
            </div>

            <aside className="rounded-2xl border border-border bg-marketing-surface p-5 dark:bg-secondary/60">
              <p className="text-sm font-semibold text-card-foreground">{meta.note}</p>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Effective {effectiveDate}
              </p>
            </aside>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 lg:px-8 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <nav aria-label={`${title} table of contents`} className="rounded-2xl border border-border bg-card p-4">
            <h2 className="px-3 pb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">On this page</h2>
            <ol className="space-y-0.5">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 text-sm leading-6 text-muted-foreground">
            This page describes the current SkillSync product. The person or organization operating a deployed version of SkillSync must publish its legal identity, contact details, and any jurisdiction-specific disclosures before a public launch.
          </div>

          <div className="mt-10 divide-y divide-border">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-28 py-9 first:pt-0"
              >
                <div className="flex items-start gap-4">
                  <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-semibold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h2 id={`${section.id}-heading`} className="text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-3xl">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-4 text-base leading-7 text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                      {section.content}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 rounded-3xl bg-marketing-strong p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-200">Keep reading</p>
            <h2 className="text-2xl font-semibold text-white">Privacy and responsible use work together.</h2>
            <Link
              to={meta.alternatePath}
              className="group mt-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-sky-900 transition-colors duration-200 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              {meta.alternateLabel}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}

import axios from "axios";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  FileText,
  Loader2,
  MapPin,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

type Workspace = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  updated_at: string;
  resumes: { id: number; filename: string; size_bytes: number; created_at: string }[];
  latest_analysis_id: number | null;
};

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Workspace[]>("/workspaces")
      .then((response) => setWorkspaces(response.data))
      .catch((requestError) => {
        const message = axios.isAxiosError(requestError)
          ? requestError.response?.data?.detail
          : null;
        setError(typeof message === "string" ? message : "Could not load your target jobs.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center" role="status">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="sr-only">Loading target jobs</span>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Career workspaces</p>
          <h1 className="text-3xl tracking-tight">Target jobs</h1>
          <p className="mt-2 text-muted-foreground">
            Keep each opportunity, resume, and future analysis together.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> New target job
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive" role="alert">
          {error}
        </div>
      )}

      {!error && workspaces.length === 0 && (
        <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center sm:p-16">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <BriefcaseBusiness className="size-7 text-primary" />
          </div>
          <h2 className="mt-5 text-2xl">Create your first target job</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Add a job description and resume to create a focused workspace for that opportunity.
          </p>
          <Link to="/upload" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-primary-foreground">
            Get started
          </Link>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((workspace) => (
          <article key={workspace.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <BriefcaseBusiness className="size-5 text-primary" />
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                {workspace.resumes.length} {workspace.resumes.length === 1 ? "resume" : "resumes"}
              </span>
            </div>
            <h2 className="mt-5 text-xl">{workspace.title}</h2>
            {workspace.company && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="size-4" /> {workspace.company}
              </p>
            )}
            {workspace.location && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {workspace.location}
              </p>
            )}
            <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {workspace.description}
            </p>
            {workspace.resumes[0] && (
              <p className="mt-5 flex items-center gap-2 truncate border-t border-border pt-4 text-sm">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="truncate">{workspace.resumes[0].filename}</span>
              </p>
            )}
            {workspace.latest_analysis_id && (
              <Link
                to={`/analysis/${workspace.latest_analysis_id}`}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm hover:bg-accent"
              >
                Open analysis <ArrowRight className="size-4" />
              </Link>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}

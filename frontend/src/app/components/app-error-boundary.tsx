import { Component, type ReactNode } from "react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12 text-foreground">
      <div role="alert" className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">We couldn’t display this page</h1>
        <p className="mt-4 leading-7 text-muted-foreground">Reload to try again. Your saved work is still available. Any unsaved edits may need to be entered again.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => window.location.reload()} className="min-h-12 cursor-pointer rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">Reload page</button>
          <a href="/" className="inline-flex min-h-12 items-center rounded-xl border border-border px-5 font-semibold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Go to home</a>
        </div>
      </div>
    </main>;
  }
}

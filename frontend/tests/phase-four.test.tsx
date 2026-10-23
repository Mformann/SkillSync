import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../src/app/components/dashboard-page";
import { GapReportPage } from "../src/app/components/gap-report-page";
import { UploadPage } from "../src/app/components/upload-page";
import { AnalysisPage } from "../src/app/components/analysis-page";
import { CareerHubPage } from "../src/app/components/career-hub-page";
import { workspaceInputError, validationDetail } from "../src/lib/workspace-validation";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), getSession: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/lib/api", () => ({ api: mocks }));
vi.mock("../src/lib/supabase", () => ({ supabase: { auth: mocks } }));
vi.mock("recharts", () => Object.fromEntries([
  "ResponsiveContainer", "LineChart", "Line", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "Bar", "BarChart",
].map(name => [name, () => null])));

const job = "We require Python and Docker for reliable production applications and automated tests.";
const summary = (score: number | null) => ({
  analysis_id: 23, status: score === null ? "pending" : "completed_fallback",
  notice: score === null ? "Run this job analysis to calculate a match." : null,
  stats: [{ label: "Latest Score", value: score }, { label: "Total Resumes", value: 1 },
    { label: "Avg Score", value: score }, { label: "Analysis Done", value: score === null ? 0 : 1 }],
  progressData: [], weeklyGoals: [],
});
function page(element: React.ReactNode, path = "/") {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="*" element={element} /><Route path="/analysis/:id" element={<p>Saved analysis</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "fixture-only" } } });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "candidate", email: "qa@example.com", user_metadata: { full_name: "QA Candidate" } } } });
});

describe("factual dashboard and gap views", () => {
  it.each([0, null])("shows an authoritative %s score without inventing a completion", async score => {
    mocks.get.mockImplementation(async (url: string) => ({ data: url === "/resume/all"
      ? [{ id: 23, filename: "fixture.docx", score: 78 }]
      : url === "/dashboard/summary" ? summary(score) : { analysis_id: 23, result: null } }));
    page(<DashboardPage />);
    const label = await screen.findByText("Latest Score");
    expect(label.parentElement?.textContent).toContain(score === null ? "Unavailable" : "0");
    expect(screen.getByText("Analysis Done").parentElement?.textContent).toContain(score === null ? "0" : "1");
    expect(screen.queryByText("78")).toBeNull();
    if (score === null) expect(screen.getByText(/Run this job analysis/)).toBeTruthy();
  });

  it.each([{ analysis_id: 99, stale: false }, { analysis_id: 23, stale: true }])("ignores an unrelated or stale learning plan: %j", async plan => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url === "/resume/all") return { data: [{ id: 23, filename: "fixture.docx" }] };
      if (url === "/dashboard/summary") return { data: summary(0) };
      if (url.includes("explainable")) return { data: { analysis_id: 23, stale: false, context: { job_title: "Engineer" }, result: {
        requirements: [{ name: "Docker", priority: "required" }], matches: [{ requirement_name: "Docker", status: "missing_skill" }],
      } } };
      return { data: { ...plan, tasks: [{ skill: "Docker", progress: 100, status: "completed" }] } };
    });
    page(<DashboardPage />);
    expect(await screen.findByRole("button", { name: "Remaining Gaps (1)" })).toBeTruthy();
    expect(screen.queryByText("Learning task complete")).toBeNull();
    expect(mocks.get.mock.calls.map(call => call[0])).toContain("/learning/plans/by-analysis/23");
  });

  it.each(["pending", "stale", "legacy", "unavailable"])("shows a %s gap notice instead of sample scores", async status => {
    mocks.get.mockResolvedValue({ data: { analysis_id: 23, status, notice: `Synthetic ${status} notice`, summaryCards: [{ label: "Sample", value: 78 }] } });
    page(<GapReportPage />);
    await screen.findByText(`Synthetic ${status} notice`);
    expect(screen.getByRole("status")).toHaveProperty("textContent", `Synthetic ${status} notice`);
    expect(screen.getByRole("link", { name: "Open analysis" }).getAttribute("href")).toBe("/analysis/23");
    expect(screen.queryByText("78")).toBeNull();
  });

  it("keeps a real zero in the completed gap report", async () => {
    mocks.get.mockResolvedValue({ data: { status: "completed_fallback", summaryCards: [{ label: "Overall evidence match", value: 0 }],
      targetRoles: [{ title: "Engineer", matchScore: 0, missingSkills: ["Docker"] }], strengthsVsGaps: { strengths: [], gaps: [] } } });
    page(<GapReportPage />);
    expect(await screen.findByText("0% Match")).toBeTruthy();
    expect(screen.getByText("Overall evidence match").parentElement?.textContent).toContain("0");
    expect(screen.queryByText(/Est. Time/)).toBeNull();
  });

  it.each(["legacy", "unavailable"])("explains a %s analysis and waits for an explicit rerun", async status => {
    mocks.get.mockResolvedValue({ data: { analysis_id: 23, status, notice: `Synthetic ${status} explanation`, result: null, scores: null } });
    page(<AnalysisPage />);
    expect(await screen.findByText(`Synthetic ${status} explanation`)).toBeTruthy();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retry Analysis" })).toBeTruthy();
  });

  it.each([0, null])("keeps the career preparation estimate at %s without a fabricated zero", async score => {
    const workspace = { workspace_id: 5, title: "Engineer", company: "Example", analysis_id: 23,
      application: null, evidence: [], sessions: [], readiness: { overall: score, components: { job_match: score }, next_best_action: "Synthetic next step" } };
    mocks.get.mockImplementation(async (url: string) => {
      if (url === "/product/analytics") throw new Error("No analytics fixture");
      return { data: url === "/career/workspaces" ? [workspace] : workspace };
    });
    page(<CareerHubPage />);
    const label = await screen.findByText("Preparation progress");
    expect(label.parentElement?.textContent).toContain(score === null ? "Unavailable" : "0%");
    expect(screen.getByText("job match").parentElement?.textContent).toContain(score === null ? "Unavailable" : "0%");
  });
});

describe("shared upload validation", () => {
  it("validates trimmed bounds and formats structured field errors", () => {
    expect(workspaceInputError(" A ", "", job)).toContain("2");
    expect(workspaceInputError("T".repeat(161), "", job)).toContain("160");
    expect(workspaceInputError("Engineer", "C".repeat(161), job)).toContain("160");
    expect(workspaceInputError("Engineer", "", " ".repeat(60))).toContain("50");
    expect(workspaceInputError(" Engineer ", "", job)).toBeNull();
    expect(validationDetail([{ loc: ["body", "job_role"], msg: "Too short" }], "Fallback")).toContain("Job title");
  });

  it("submits saved-job edits and resume together, then preserves edits on a failed upload", async () => {
    mocks.get.mockResolvedValue({ data: { title: "Engineer", company: "Original", description: job, ai_consent: false } });
    mocks.post.mockRejectedValue({ isAxiosError: true, response: { data: { detail: [{ loc: ["body", "job_role"], msg: "Synthetic validation failure" }] } } });
    const view = page(<UploadPage />, "/upload?workspace=5");
    await waitFor(() => expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe("Engineer"));
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Changed engineer" } });
    fireEvent.change(view.container.querySelector("#resume-file")!, { target: { files: [new File(["fixture-only"], "fixture.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume to saved job" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Job title: Synthetic validation failure");
    expect(mocks.patch).not.toHaveBeenCalled();
    const data = mocks.post.mock.calls[0][1] as FormData;
    expect(data.get("workspace_id")).toBe("5");
    expect(data.get("job_role")).toBe("Changed engineer");
    expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe("Changed engineer");
  });
});

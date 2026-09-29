import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { SkillAssessmentsPanel } from "../src/app/components/skill-assessments-panel";
import { GrowthPlannerPanel } from "../src/app/components/growth-planner-panel";
import { GrowthJobsPanel } from "../src/app/components/growth-jobs-panel";
import { GrowthContactsPanel } from "../src/app/components/growth-contacts-panel";
import { GrowthInterviewPanel } from "../src/app/components/growth-interview-panel";
import { GrowthPassportPanel } from "../src/app/components/growth-passport-panel";
import { PublicPassportPage } from "../src/app/components/public-passport-page";
import { CareerGrowthPage } from "../src/app/components/career-growth-page";
import { CareerReminderBell } from "../src/app/components/career-reminder-bell";
import { externalUrl, growthError, splitPreferences } from "../src/lib/growth";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), session: null as unknown }));
vi.mock("../src/lib/api", () => ({ api: mocks, API_BASE_URL: "http://test-api" }));
vi.mock("../src/app/auth-provider", () => ({ useAuth: () => ({ session: mocks.session }) }));
const workspace = { id: 1, title: "Frontend engineer", company: "Acme", latest_analysis_id: 2 };
const questions = [1, 2, 3].map(n => ({ id: `q${n}`, prompt: `Question ${n}`, options: [`Correct option ${n}`, `Other option ${n}`] }));
const attempt = { id: 8, skill: "React", score: null, submitted_at: null, created_at: "2026-09-17", questions, scope: "Unproctored" };
const evidence = { id: 10, title: "React project", description: "A working project with accessible interactions.", url: "https://example.com", skills: ["React"], verification_status: "self_reported" };
const passport = { name: "Candidate", headline: "Frontend", disclaimer: "Knowledge checks are unproctored.", expires_at: "2026-09-24", evidence: [evidence], assessments: [], reviews: [] };
function page(element: React.ReactNode) { return render(<MemoryRouter>{element}</MemoryRouter>); }

beforeEach(() => {
  vi.resetAllMocks(); mocks.session = null;
  mocks.get.mockImplementation(async (url: string) => {
    const responses: Record<string, unknown> = {
      "/workspaces": [workspace], "/growth/assessments": { supported_skills: ["React", "SQL"], attempts: [] },
      "/learning/plans/by-analysis/2": { id: 3, hours_per_week: 5, target_date: "2026-10-17", tasks: [] },
      "/growth/plans/3/schedule": { schedule: null, study_days: [0, 2, 4] },
      "/growth/jobs": { configured: false, jobs: [], errors: [], sources: [] },
      "/growth/preferences": { roles: [], locations: [], remote_only: false, minimum_salary: null, currency: "INR" },
      "/growth/contacts": [], "/growth/reminders": { items: [], today: "2026-09-17", delivery: "in_app_and_calendar" },
      "/career/workspaces/1": { sessions: [] }, "/growth/passport/options": { evidence: [evidence], assessments: [] },
      "/growth/passport/shares": [],
    };
    if (!(url in responses)) throw new Error(`Unexpected URL ${url}`);
    return { data: responses[url] };
  });
  mocks.post.mockResolvedValue({ data: {} }); mocks.put.mockResolvedValue({ data: {} }); mocks.delete.mockResolvedValue({ data: {} });
});

describe("growth helpers", () => {
  it.each(["javascript:alert(1)", "data:text/html,bad", "http://example.com", "https://name:secret@example.com", "bad"])("does not link unsafe external URLs: %s", url => expect(externalUrl(url)).toBeUndefined());
  it("allows plain HTTPS links", () => expect(externalUrl("https://example.com/project")).toBe("https://example.com/project"));
  it("normalizes preferences", () => expect(splitPreferences(" React, SQL, React, , ")).toEqual(["React", "SQL"]));
  it("provides a recoverable connection error", () => expect(growthError(new Error())).toContain("try again"));
});

it("grades an assessment using only selected answers, then displays server feedback", async () => {
  mocks.post.mockImplementation(async (url: string) => ({ data: url.endsWith("submit") ? { ...attempt, score: 100, submitted_at: "2026-09-17", improvement: 33, results: [{ id: "q1", correct: true, explanation: "Server explanation" }] } : attempt }));
  page(<SkillAssessmentsPanel />);
  await userEvent.click(await screen.findByRole("button", { name: "Start knowledge check" }));
  for (const n of [1, 2, 3]) await userEvent.click(screen.getByRole("radio", { name: `Correct option ${n}` }));
  await userEvent.click(screen.getByRole("button", { name: "Submit for grading" }));
  expect(await screen.findByText("100%")).toBeTruthy();
  expect(mocks.post).toHaveBeenLastCalledWith("/growth/assessments/8/submit", { answers: { q1: 0, q2: 0, q3: 0 } });
  expect(screen.getByText(/Server explanation/)).toBeTruthy();
});

it("shows a resource error with a retry action instead of a false empty history", async () => {
  mocks.get.mockRejectedValue(new Error("offline")); page(<SkillAssessmentsPanel />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.queryByText("Your first assessment will appear here.")).toBeNull();
});

it("waits for saved study days before allowing planner edits", async () => {
  let resolveSchedule!: (response: { data: { schedule: null; study_days: number[] } }) => void;
  const saved = new Promise<{ data: { schedule: null; study_days: number[] } }>(resolve => { resolveSchedule = resolve; });
  mocks.get.mockImplementation(async (url: string) => url.endsWith("/schedule") ? saved : { data: { id: 3, hours_per_week: 5, target_date: "2026-10-17", tasks: [] } });
  page(<GrowthPlannerPanel workspace={workspace} />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/growth/plans/3/schedule", expect.anything()));
  expect(screen.queryByLabelText("Hours per week")).toBeNull();
  resolveSchedule({ data: { schedule: null, study_days: [1, 3] } });
  expect(await screen.findByLabelText("Hours per week")).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: "Tue" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Mon" }) as HTMLInputElement).checked).toBe(false);
});

it("reschedules with selected capacity and shows an impossible-deadline warning", async () => {
  mocks.post.mockResolvedValue({ data: { remaining_hours: 10, available_hours: 1, at_risk: true, projected_finish: "2026-11-01", warning: "Deadline exceeds available study capacity.", sessions: [] } });
  page(<GrowthPlannerPanel workspace={workspace} />);
  const hours = await screen.findByLabelText("Hours per week"); fireEvent.change(hours, { target: { value: "1" } });
  await userEvent.click(screen.getByRole("button", { name: "Reschedule remaining work" }));
  expect(await screen.findByText("Deadline exceeds available study capacity.")).toBeTruthy();
  expect(mocks.post).toHaveBeenCalledWith("/growth/plans/3/replan", { hours_per_week: 1, target_date: "2026-10-17", study_days: [0, 2, 4] });
});

it("captures a supported job only after the user reviews and saves it", async () => {
  const imported = { title: "Frontend engineer", company: "Acme", location: "Remote", description: "Build accessible React applications with TypeScript and automated tests.", employment_type: "Full time", url: "https://jobs.lever.co/acme/abc" };
  mocks.post.mockImplementation(async (url: string) => ({ data: url.endsWith("preview") ? imported : { workspace_id: 42, already_saved: false } }));
  const onSaved = vi.fn(); page(<GrowthJobsPanel onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("Job listing URL"), { target: { value: imported.url } });
  await userEvent.click(screen.getByRole("button", { name: "Preview job" }));
  const save = await screen.findByRole("button", { name: "Save reviewed job" });
  expect(onSaved).not.toHaveBeenCalled(); await userEvent.click(save);
  expect(await screen.findByRole("link", { name: "Upload resume for saved job" })).toBeTruthy();
  expect(mocks.post).toHaveBeenLastCalledWith("/growth/jobs/save", imported); expect(onSaved).toHaveBeenCalledOnce();
});

it("states explicitly when live feeds are not configured", async () => {
  page(<GrowthJobsPanel onSaved={vi.fn()} />);
  expect(await screen.findByText(/Live feeds are not configured yet/)).toBeTruthy();
});

it("saves job preferences with salary currency and explicit remote filter", async () => {
  page(<GrowthJobsPanel onSaved={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText("Role keywords, separated by commas"), { target: { value: "Frontend, React" } });
  fireEvent.change(screen.getByLabelText("Minimum annual salary (optional)"), { target: { value: "800000" } });
  await userEvent.click(screen.getByLabelText("Remote listings only")); await userEvent.click(screen.getByRole("button", { name: "Update matches" }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/growth/preferences", { roles: ["Frontend", "React"], locations: [], remote_only: true, minimum_salary: 800000, currency: "INR" }));
});

it("requires selected evidence and sharing consent before creating a passport", async () => {
  mocks.post.mockResolvedValue({ data: { path: "/passport/unguessable-token" } }); page(<GrowthPassportPanel />);
  const create = await screen.findByRole("button", { name: "Create sharing link" }); expect((create as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByLabelText(/React project/)); await userEvent.click(screen.getByLabelText(/I agree to share/)); await userEvent.click(create);
  expect(await screen.findByLabelText("Your sharing link")).toBeTruthy();
  expect(mocks.post).toHaveBeenCalledWith("/growth/passport/shares", { evidence_ids: [10], assessment_ids: [], expires_in_days: 7, sharing_consent: true });
  expect(screen.getByText(/secret link is not stored in recoverable form/)).toBeTruthy();
});

it("adds private contacts without sending any communication", async () => {
  page(<GrowthContactsPanel workspace={workspace} />); fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Recruiter" } });
  await userEvent.click(screen.getByRole("button", { name: "Add contact" }));
  expect(await screen.findByText("Contact saved. No message has been sent.")).toBeTruthy();
  expect(mocks.post).toHaveBeenCalledWith("/growth/contacts", expect.objectContaining({ workspace_id: 1, name: "Recruiter" }));
});

it("adds an in-app reminder and explains its delivery limits", async () => {
  page(<GrowthContactsPanel workspace={workspace} />); fireEvent.change(screen.getByLabelText("Reminder"), { target: { value: "Ask for referral" } });
  await userEvent.click(screen.getByRole("button", { name: "Add reminder" }));
  expect(await screen.findByText(/Export it to your calendar for alerts outside SkillSync/)).toBeTruthy();
});

it("displays a contextual interview follow-up without fabricating a semantic score", async () => {
  const session = { id: 7, questions: [{ id: "q1", question: "Explain your React approach", requirement: "React" }], answers: {}, scores: {} };
  const feedback = { mode: "guided_practice", overall: null, feedback: ["Practice saved"], follow_up: "What specific decision did you make?" };
  mocks.post.mockImplementation(async (url: string) => ({ data: url.endsWith("turn") ? { feedback, follow_up: { id: "f1", question: feedback.follow_up, parent_id: "q1", requirement: "React" } } : session }));
  page(<GrowthInterviewPanel workspace={workspace} />); await userEvent.click(screen.getByRole("button", { name: "Start new practice session" }));
  fireEvent.change(await screen.findByLabelText("Your answer"), { target: { value: "I built an accessible React application and tested the user interactions." } });
  await userEvent.click(screen.getByRole("button", { name: "Save answer and get follow-up" }));
  expect(await screen.findByText("Guided practice · no semantic score")).toBeTruthy();
  expect(screen.getAllByText("What specific decision did you make?").length).toBeGreaterThan(0);
  expect(mocks.post).toHaveBeenLastCalledWith("/growth/interviews/7/turn", expect.objectContaining({ ai_consent: false }));
});

it("public passport loads without attaching authentication and sanitizes evidence links", async () => {
  const publicGet = vi.spyOn(axios, "get").mockResolvedValue({ data: { ...passport, evidence: [{ ...evidence, url: "javascript:alert(1)" }] } });
  render(<MemoryRouter initialEntries={["/passport/secret-token"]}><Routes><Route path="/passport/:token" element={<PublicPassportPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Candidate" })).toBeTruthy();
  expect(publicGet).toHaveBeenCalledWith("http://test-api/growth/public/passport/secret-token", expect.objectContaining({ timeout: 15000 }));
  expect(screen.queryByRole("link", { name: "View supporting evidence" })).toBeNull();
  expect(document.querySelector('meta[name="referrer"][content="no-referrer"]')).toBeTruthy(); publicGet.mockRestore();
});

it("public passport unavailable state does not show a review form", async () => {
  const publicGet = vi.spyOn(axios, "get").mockRejectedValue({ isAxiosError: true, response: { data: { detail: "Passport link is unavailable or expired." } } });
  render(<MemoryRouter initialEntries={["/passport/expired-token"]}><Routes><Route path="/passport/:token" element={<PublicPassportPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByLabelText("Public review comments")).toBeNull(); publicGet.mockRestore();
});

it("routes career growth sections through accessible deep links", async () => {
  page(<CareerGrowthPage />); await screen.findByRole("button", { name: "Start knowledge check" });
  await userEvent.click(screen.getByRole("link", { name: "Find & capture jobs" }));
  expect(await screen.findByRole("heading", { name: "Capture a job opportunity" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Find & capture jobs" }).getAttribute("aria-current")).toBe("page");
});

it("reminder bell counts due items without exposing contact information", async () => {
  mocks.get.mockResolvedValue({ data: { today: "2026-09-17", items: [{ due_date: "2026-09-16" }, { due_date: "2026-09-17" }, { due_date: "2026-10-01" }] } });
  page(<CareerReminderBell />); expect(await screen.findByRole("link", { name: "Reminder inbox, 2 due" })).toBeTruthy();
});

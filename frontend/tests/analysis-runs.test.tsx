import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisPage } from "../src/app/components/analysis-page";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../src/lib/api", () => ({ api: mocks }));
const completed = {
  analysis_id: 23, workspace_id: 5, status: "completed_ai", stale: false,
  provider: "groq", model: "synthetic-model", prompt_version: "test", fallback_reason: null,
  context: { job_title: "Python engineer", company: "Example", resume_filename: "synthetic.docx" },
  scores: { overall: 70, required: 70, preferred: 0, evidence_confidence: 90, formula_version: "test" },
  result: { summary: "Synthetic result", candidate_positioning: "Synthetic positioning", requirements: [], matches: [], strengths: [], resume_risks: [] },
};
const pending = { ...completed, status: "pending", result: null, scores: null };
const processing = { ...pending, status: "processing" };

function page(path = "/analysis/23", strict = false) {
  const element = <MemoryRouter initialEntries={[path]}><Routes><Route path="/analysis/:id" element={<AnalysisPage />} /></Routes></MemoryRouter>;
  return render(strict ? <StrictMode>{element}</StrictMode> : element);
}

beforeEach(() => { vi.resetAllMocks(); });

describe("analysis run lifecycle", () => {
  it.each(["/analysis/23", "/analysis/latest"])("starts one run without reloading when the numeric ID resolves: %s", async path => {
    mocks.get.mockResolvedValue({ data: pending });
    mocks.post.mockResolvedValue({ data: completed });
    page(path);
    expect(await screen.findByText("Synthetic result")).toBeTruthy();
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0][0]).toBe("/resume/analysis/23/run");
  });

  it("does not duplicate an automatic run during StrictMode effect replay", async () => {
    mocks.get.mockResolvedValue({ data: pending });
    mocks.post.mockResolvedValue({ data: completed });
    page("/analysis/23", true);
    await screen.findByText("Synthetic result");
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("polls an active run using GET without sending another run request", async () => {
    mocks.get.mockResolvedValueOnce({ data: processing }).mockResolvedValue({ data: completed });
    page();
    expect(await screen.findByText("Synthetic result", {}, { timeout: 2500 })).toBeTruthy();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.get.mock.calls[1][0]).toBe("/resume/analysis/23/explainable");
  });

  it.each(["stale", "failed"])("requires explicit action for a %s result", async status => {
    mocks.get.mockResolvedValue({ data: { ...pending, status, stale: status === "stale" } });
    mocks.post.mockResolvedValue({ data: completed });
    page();
    const action = await screen.findByRole("button", { name: status === "stale" ? "Run current analysis" : "Retry Analysis" });
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(action);
    await screen.findByText("Synthetic result");
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("polls a duplicate processing response after a deliberate rerun", async () => {
    mocks.get.mockResolvedValue({ data: completed });
    mocks.post.mockResolvedValue({ data: processing });
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Re-run analysis" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2), { timeout: 2500 });
    expect(await screen.findByText("Synthetic result")).toBeTruthy();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("does not initiate another run when a request times out", async () => {
    mocks.get.mockResolvedValue({ data: pending });
    mocks.post.mockRejectedValue(new Error("synthetic timeout"));
    page();
    expect(await screen.findByText(/Reload to check its status before retrying/)).toBeTruthy();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("aborts the active request when navigating away", async () => {
    mocks.get.mockResolvedValue({ data: pending });
    mocks.post.mockReturnValue(new Promise(() => {}));
    const rendered = page();
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    rendered.unmount();
    expect(signal.aborted).toBe(true);
  });

  it("stops polling at its total deadline even when a status request never settles", async () => {
    vi.useFakeTimers();
    try {
      mocks.get.mockResolvedValueOnce({ data: processing }).mockReturnValue(new Promise(() => {}));
      page();
      await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
      expect(screen.getByText(/Reload to check its status/)).toBeTruthy();
      expect(mocks.post).not.toHaveBeenCalled();
      expect(mocks.get.mock.calls[1][1].signal.aborted).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});

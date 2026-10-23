import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../src/app/components/app-error-boundary";

it("keeps normal application content visible", () => {
  render(<AppErrorBoundary><h1>Dashboard</h1></AppErrorBoundary>);
  expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("offers recovery after a render failure without exposing exception details", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  function BrokenPage(): never { throw new Error("private candidate details"); }
  try {
    render(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>);
    expect(screen.getByRole("alert").textContent).not.toContain("private candidate details");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe("/");
  } finally { consoleError.mockRestore(); }
});

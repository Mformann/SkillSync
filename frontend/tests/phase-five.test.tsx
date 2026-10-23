import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkspacesPage } from "../src/app/components/workspaces-page";
import { CareerGrowthPage } from "../src/app/components/career-growth-page";
import { usePagedList } from "../src/lib/paged-list";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../src/lib/api", () => ({ api: mocks }));
vi.mock("../src/app/components/growth-planner-panel", () => ({
  GrowthPlannerPanel: ({ workspace }: { workspace?: { id: number } }) => <p>{workspace ? `Planner for ${workspace.id}` : "No selected workspace"}</p>,
}));
const item = (id: number) => ({ id, title: `Role ${id}`, description: "Job description preview", company: null,
  location: null, resumes: [{ id, filename: "latest.docx" }], resume_count: 8, latest_analysis_id: id });
const page = (items: unknown[], cursor = "") => ({ data: items, headers: { "x-next-cursor": cursor } });
beforeEach(() => vi.resetAllMocks());

it("appends an older page and shows the actual resume count instead of the preview length", async () => {
  mocks.get.mockResolvedValueOnce(page([item(9)], "9")).mockResolvedValueOnce(page([item(8)]));
  render(<MemoryRouter><WorkspacesPage /></MemoryRouter>);
  expect(await screen.findByText("8 resumes")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Load more target jobs" }));
  expect(await screen.findByRole("heading", { name: "Role 8" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Role 9" })).toBeTruthy();
  expect(mocks.get.mock.calls[1][1].params).toEqual({ before_id: 9 });
  expect(screen.queryByRole("button", { name: "Load more target jobs" })).toBeNull();
});

it("keeps visible jobs on a paging error and retries the same cursor", async () => {
  mocks.get.mockResolvedValueOnce(page([item(9)], "9")).mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(page([item(8)]));
  render(<MemoryRouter><WorkspacesPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Load more target jobs" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("heading", { name: "Role 9" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Role 8" });
  expect(mocks.get.mock.calls.slice(1).map(call => call[1].params)).toEqual([{ before_id: 9 }, { before_id: 9 }]);
});

function List() {
  const resource = usePagedList<{ id: number }>("/workspaces", "id");
  return <><button onClick={resource.loadMore}>More</button><button onClick={resource.reload}>Reload</button><p>{resource.data?.map(row => row.id).join(",")}</p></>;
}
it("deduplicates rows and blocks repeated clicks while the next page is loading", async () => {
  let resolve!: (value: ReturnType<typeof page>) => void;
  mocks.get.mockResolvedValueOnce(page([{ id: 9 }], "9")).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  render(<List />); await screen.findByText("9");
  fireEvent.click(screen.getByText("More"));fireEvent.click(screen.getByText("More"));
  expect(mocks.get).toHaveBeenCalledTimes(2);
  await act(async () => resolve(page([{ id: 9 }, { id: 8 }])));
  expect(await screen.findByText("9,8")).toBeTruthy();
});

it("aborts a pending page when the component unmounts", async () => {
  mocks.get.mockReturnValue(new Promise(() => {}));
  const view = render(<List />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  const signal = mocks.get.mock.calls[0][1].signal as AbortSignal;
  view.unmount();expect(signal.aborted).toBe(true);
});

it("opens a linked workspace beyond the initial page instead of using the first job", async () => {
  mocks.get.mockImplementation(async (url: string) => url === "/workspaces" ? page([item(90)], "90") : { data: item(1) });
  render(<MemoryRouter initialEntries={["/career/growth?workspace=1&tab=planner"]}><CareerGrowthPage /></MemoryRouter>);
  expect(await screen.findByText("Planner for 1")).toBeTruthy();
  expect(screen.queryByText("Planner for 90")).toBeNull();
  expect((screen.getByLabelText("Target-job workspace") as HTMLSelectElement).value).toBe("1");
  expect(mocks.get.mock.calls.map(call => call[0])).toContain("/workspaces/1");
});

it("does not silently fall back to a different job when a linked workspace is unavailable", async () => {
  mocks.get.mockImplementation(async (url: string) => {
    if (url === "/workspaces") return page([item(90)]);
    throw new Error("not found");
  });
  render(<MemoryRouter initialEntries={["/career/growth?workspace=1&tab=planner"]}><CareerGrowthPage /></MemoryRouter>);
  await screen.findByRole("alert");
  expect(screen.getByText("No selected workspace")).toBeTruthy();
  expect(screen.queryByText("Planner for 90")).toBeNull();
});

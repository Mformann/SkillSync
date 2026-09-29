import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: { auth } }));
const oldSession = { access_token: "old-access-token" };
const newSession = { access_token: "new-access-token" };
function response(config: InternalAxiosRequestConfig, status = 200) {
  return { config, status, statusText: String(status), headers: {}, data: {} };
}
function rejected(config: InternalAxiosRequestConfig, status: number) {
  return Promise.reject(new AxiosError("Request rejected", "ERR_BAD_REQUEST", config, undefined, response(config, status)));
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: oldSession } });
  auth.refreshSession.mockImplementation(async () => {
    auth.getSession.mockResolvedValue({ data: { session: newSession } });
    return { data: { session: newSession }, error: null };
  });
});
describe("authenticated API requests", () => {
  it("sends the current Supabase access token", async () => {
    const adapter = vi.fn<AxiosAdapter>(async config => response(config));
    await api.get("/auth/me", { adapter });
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer old-access-token");
  });
  it("refreshes an expired token and retries once", async () => {
    const adapter = vi.fn<AxiosAdapter>(async config => (config as InternalAxiosRequestConfig & { sessionRetried?: boolean }).sessionRetried ? response(config) : rejected(config, 401));
    await api.get("/auth/me", { adapter });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe("Bearer new-access-token");
    expect(auth.refreshSession).toHaveBeenCalledOnce();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("does not loop or sign out when the backend still rejects the refreshed token", async () => {
    const adapter = vi.fn<AxiosAdapter>(async config => rejected(config, 401));
    await expect(api.get("/auth/me", { adapter })).rejects.toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(auth.refreshSession).toHaveBeenCalledOnce();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("shares a refresh across simultaneous failed requests", async () => {
    let resolveRefresh: (value: unknown) => void = () => {};
    auth.refreshSession.mockReturnValue(new Promise(resolve => { resolveRefresh = resolve; }));
    let firstRequests = 0;
    let allStarted: () => void = () => {};
    const started = new Promise<void>(resolve => { allStarted = resolve; });
    const adapter: AxiosAdapter = async config => {
      if ((config as InternalAxiosRequestConfig & { sessionRetried?: boolean }).sessionRetried) return response(config);
      firstRequests++;
      if (firstRequests === 3) allStarted();
      return rejected(config, 401);
    };
    const requests = [1, 2, 3].map(id => api.get(`/resource/${id}`, { adapter }));
    await started;
    await new Promise(resolve => setTimeout(resolve, 0));
    auth.getSession.mockResolvedValue({ data: { session: newSession } });
    resolveRefresh({ data: { session: newSession }, error: null });
    await Promise.all(requests);
    expect(auth.refreshSession).toHaveBeenCalledOnce();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it.each([403, 404, 503])("does not refresh or log out on status %s", async status => {
    await expect(api.get("/auth/me", { adapter: config => rejected(config, status) })).rejects.toBeInstanceOf(AxiosError);
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("reports the original failure if refreshing fails", async () => {
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("refresh failed") });
    const adapter = vi.fn<AxiosAdapter>(config => rejected(config, 401));
    await expect(api.get("/auth/me", { adapter })).rejects.toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledOnce();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

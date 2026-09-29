import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../src/app/auth-provider";
import { LoginPage } from "../src/app/components/login-page";
import { SignupPage } from "../src/app/components/signup-page";
import { ForgotPasswordPage, ResetPasswordPage } from "../src/app/components/password-recovery-page";
import { PasswordInput } from "../src/app/components/password-input";
import { postLoginPath, authErrorMessage } from "../src/lib/auth-navigation";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  unsubscribe: vi.fn(), listener: null as null | ((event: string, session: unknown) => void),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: { auth: {
  ...mocks,
  onAuthStateChange: (listener: typeof mocks.listener) => {
    mocks.listener = listener;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  },
} } }));
const session = { access_token: "test-token", user: { id: "candidate-id" } };
function Location() { const location = useLocation(); return <p data-testid="location">{location.pathname + location.search + location.hash}</p>; }
function AuthStatus() { const auth = useAuth(); return <p>{auth.loading ? "loading" : auth.error || (auth.session ? "signed in" : "signed out")}{auth.passwordRecovery ? " recovery" : ""}</p>; }
function renderPage(page: React.ReactNode, state?: unknown) {
  return render(<AuthProvider><MemoryRouter initialEntries={[{ pathname: "/login", state }]}><Routes><Route path="/login" element={page} /><Route path="*" element={<Location />} /></Routes></MemoryRouter></AuthProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.listener = null;
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("safe post-login destinations", () => {
  it("keeps the intended local path, query, and hash", () => expect(postLoginPath({ from: "/workspaces?job=123#resume" })).toBe("/workspaces?job=123#resume"));
  it.each([undefined, {}, { from: "https://evil.example" }, { from: "//evil.example" }, { from: "/\\evil.example" }, { from: "/login?loop=1" }, { from: "/reset-password" }, { from: "/x\n" }])("rejects unsafe or looping destinations: %j", state => expect(postLoginPath(state)).toBe("/dashboard"));
  it("explains unconfirmed email", () => expect(authErrorMessage(new Error("Email not confirmed"), "fallback")).toContain("confirm your email"));
});

describe("session initialization", () => {
  it("ends loading and explains a rejected session request", async () => {
    mocks.getSession.mockRejectedValue(new Error("network failed"));
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    expect(await screen.findByText(/couldn't restore your session/)).toBeTruthy();
  });
  it("does not overwrite a newer auth event with a stale session result", async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.getSession.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<AuthProvider><AuthStatus /></AuthProvider>);
    act(() => mocks.listener?.("SIGNED_IN", session));
    await act(async () => resolve({ data: { session: null }, error: null }));
    expect(screen.getByText("signed in")).toBeTruthy();
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
  it("tracks password recovery separately from normal sign-in", () => {
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    act(() => mocks.listener?.("PASSWORD_RECOVERY", session));
    expect(screen.getByText("signed in recovery")).toBeTruthy();
    act(() => mocks.listener?.("SIGNED_OUT", null));
    expect(screen.getByText("signed out")).toBeTruthy();
  });
});

describe("login and signup", () => {
  it("announces a login error, focuses it, and re-enables the form", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: new Error("Invalid login credentials") });
    renderPage(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "candidate@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "incorrect-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    const feedback = await screen.findByRole("alert");
    expect(feedback.textContent).toContain("Invalid login credentials");
    expect(document.activeElement).toBe(feedback);
    expect((screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
  });
  it("navigates to the intended route when a session arrives", async () => {
    renderPage(<LoginPage />, { from: "/workspaces?job=123#resume" });
    act(() => mocks.listener?.("SIGNED_IN", session));
    expect((await screen.findByTestId("location")).textContent).toBe("/workspaces?job=123#resume");
  });
  it("sends a recovery session to reset-password rather than the dashboard", async () => {
    renderPage(<LoginPage />);
    act(() => mocks.listener?.("PASSWORD_RECOVERY", session));
    expect((await screen.findByTestId("location")).textContent).toBe("/reset-password");
  });
  it.each([null, session])("handles confirmation-required and immediate-session signup (%j)", async nextSession => {
    mocks.signUp.mockResolvedValue({ data: { session: nextSession }, error: null });
    renderPage(<SignupPage />);
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Candidate" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "candidate@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-strong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    if (nextSession) expect((await screen.findByTestId("location")).textContent).toBe("/dashboard");
    else expect((await screen.findByRole("status")).textContent).toContain("Check your inbox");
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${window.location.origin}/login`);
  });
  it("allows showing and hiding the password without submitting", async () => {
    render(<><label htmlFor="password">Password</label><PasswordInput id="password" autoComplete="current-password" /></>);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const user = userEvent.setup();
    expect(input.type).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
    expect(input.autocomplete).toBe("current-password");
  });
});

describe("password recovery", () => {
  it("requests a reset link with the correct redirect and neutral confirmation", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    renderPage(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "candidate@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect((await screen.findByRole("status")).textContent).toContain("If an account exists");
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("candidate@example.com", { redirectTo: `${window.location.origin}/reset-password` });
  });
  it("offers a new reset link when the recovery session is missing", async () => {
    renderPage(<ResetPasswordPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("missing or has expired");
    expect(screen.getByRole("link", { name: "Request a new reset link" }).getAttribute("href")).toBe("/forgot-password");
  });
  it("rejects mismatched passwords without changing the account", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    renderPage(<ResetPasswordPage />);
    fireEvent.change(await screen.findByLabelText("New password"), { target: { value: "strong-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("don't match");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("updates the password and signs out all refresh sessions", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    renderPage(<ResetPasswordPage />);
    fireEvent.change(await screen.findByLabelText("New password"), { target: { value: "strong-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "strong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "strong-password" });
    expect((await screen.findByRole("status")).textContent).toContain("password has been updated");
  });
});

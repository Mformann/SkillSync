import { expect, test } from "@playwright/test";

test("landing page communicates the product clearly across breakpoints", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /turn your resume into a career plan/i })).toBeVisible();
  const brandLogo = page.getByRole("link", { name: "SkillSync home" }).first().locator("img");
  await expect(brandLogo).toHaveAttribute("src", "/brand/skillsync-lockup-tagline.png");
  await expect(brandLogo).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(brandLogo).toHaveCSS("border-top-width", "0px");
  expect(await brandLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/brand/skillsync-mark.png");
  expect((await page.request.get("/brand/skillsync-lockup-tagline.png")).ok()).toBe(true);
  await expect(page.getByRole("link", { name: "Start with your target role" })).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(page.getByText("Sample analysis")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("heading", { name: "Your career data stays under your control." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 812, height: 375 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("link", { name: "Product", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Everything you need to become a stronger candidate." })).toBeVisible();
  const footerLogo = page.getByRole("contentinfo").getByRole("link", { name: "SkillSync home" }).locator("img");
  await expect(footerLogo).toHaveAttribute("src", "/brand/skillsync-lockup-tagline.png");
  expect(await footerLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Sign in" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("public legal pages are readable, linked, and available without signing in", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/privacy-policy");
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole("heading", { name: "Privacy policy", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Privacy policy table of contents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Optional AI processing" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("link", { name: "Optional AI processing" }).click();
  await expect(page).toHaveURL(/#ai-processing$/);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/terms");
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "Terms & conditions", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Terms & conditions table of contents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI output and career guidance" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the privacy policy" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("a simulated sign-in reaches the dashboard and signs out cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 });
  const user = { id: "ca3c5e53-36b9-4ed0-95cb-5843f7d6a9eb", aud: "authenticated", role: "authenticated", email: "candidate@example.com", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { full_name: "Browser Candidate" }, created_at: new Date().toISOString() };
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, aud: "authenticated", iss: "https://fixture.supabase.co/auth/v1", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).toString("base64url"), "c2lnbmF0dXJl"].join(".");
  // All auth requests are intercepted: these fixture credentials never leave
  // the browser test and do not exercise a real hosted Supabase account.
  await page.route("**/auth/v1/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/logout")) await route.fulfill({ status: 204 });
    else if (pathname.endsWith("/user")) await route.fulfill({ json: user });
    else await route.fulfill({ json: { access_token: token, refresh_token: "fixture-refresh-token", token_type: "bearer", expires_in: 3600, user } });
  });
  await page.route("**/resume/**", route => route.fulfill({ json: route.request().url().endsWith("/all") ? [] : { gapAnalysis: [] } }));
  await page.route("**/learning/plans/latest", route => route.fulfill({ json: { tasks: [] } }));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password-never-sent");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome, Browser Candidate!" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(page.locator("#mobile-navigation").getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome, Browser Candidate!" })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }, { width: 1440, height: 900 }]) {
  test(`auth screens remain readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const input = page.getByLabel("Email", { exact: true });
    await expect(input).toHaveCSS("background-color", "rgb(15, 23, 42)");
    await expect(input).toHaveCSS("color", "rgb(241, 245, 249)");
    expect(await input.evaluate(element => getComputedStyle(element, "::placeholder").color)).toBe("rgb(170, 192, 214)");
    await input.fill("candidate@example.com");
    await page.getByLabel("Password", { exact: true }).fill("display-only-password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/login-dark-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveCSS("background-color", "rgb(15, 23, 42)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/reset-password");
    await expect(page.getByRole("alert")).toContainText("missing or has expired");
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Full Name")).toHaveCSS("background-color", "rgb(15, 23, 42)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/signup-dark-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.getByLabel("Full Name")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    expect(errors).toEqual([]);
  });
}

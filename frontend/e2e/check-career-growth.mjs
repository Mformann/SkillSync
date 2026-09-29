// Offline UI verification: actual components + production CSS, explicit test
// fixtures. No dev server, real account, external API, or network request.
/* global document, getComputedStyle, window */
import assert from "node:assert/strict";
import process from "node:process";
import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const workspace = { id: 1, title: "Frontend engineer", company: "Example employer", latest_analysis_id: 2 };
const job = { source_id: "test:1", title: "Frontend engineer", company: "Example employer", location: "Remote", description: "Build accessible React applications with TypeScript and automated tests.", url: "https://example.com/job", employment_type: "Full time", matched_skills: ["React"], missing_skills: ["TypeScript"], alignment: 50, explanation: "Fixture: one of two recognized terms has a passed knowledge check." };
const evidence = { id: 10, title: "Accessible React dashboard", description: "A working dashboard with keyboard navigation, responsive cards, and meaningful error states.", url: "https://example.com/project", skills: ["React"], verification_status: "self_reported" };
const fixtures = {
  "/workspaces": [workspace],
  "/growth/assessments": { supported_skills: ["React", "Python", "SQL", "JavaScript", "TypeScript", "Docker", "Git"], attempts: [{ id: 4, skill: "SQL", score: 67, created_at: "2026-09-17", submitted_at: "2026-09-17", questions: [] }] },
  "/learning/plans/by-analysis/2": { id: 3, hours_per_week: 5, target_date: "2026-10-17", tasks: [] },
  "/growth/plans/3/schedule": { study_days: [0, 2, 4], schedule: { remaining_hours: 12, available_hours: 10, at_risk: true, projected_finish: "2026-10-23", warning: "Deadline exceeds available study capacity. Increase time, narrow scope, or extend the deadline.", sessions: [{ task_id: 1, skill: "React", title: "Build accessible job-ready evidence", date: "2026-09-18", minutes: 30 }] } },
  "/growth/jobs": { configured: true, jobs: [job], errors: [], sources: ["Test fixtures only"] },
  "/growth/preferences": { roles: ["Frontend"], locations: ["Bengaluru"], remote_only: false, minimum_salary: 800000, currency: "INR" },
  "/growth/contacts": [{ id: 1, workspace_id: 1, name: "Example recruiter", contact_type: "recruiter", email: "recruiter@example.com", url: "https://example.com", notes: "Discussed the application timeline.", communication_history: "2026-09-17: agreed to review project evidence." }],
  "/growth/reminders": { today: "2026-09-17", items: [{ id: "manual:1", title: "Send portfolio to recruiter", due_date: "2026-09-17", kind: "reminder", workspace_id: 1, path: "/career" }] },
  "/career/workspaces/1": { sessions: [{ id: 7, questions: [{ id: "q1", question: "Explain how you would test an accessible React application.", requirement: "React" }], answers: {}, scores: {} }] },
  "/growth/passport/options": { evidence: [evidence], assessments: [{ id: 4, skill: "SQL", score: 67, created_at: "2026-09-17", submitted_at: "2026-09-17", questions: [] }] },
  "/growth/passport/shares": [{ id: 1, created_at: "2026-09-17", expires_at: "2026-10-17", revoked: false, snapshot: { evidence: [evidence], assessments: [{ skill: "SQL", score: 67 }] } }],
};
const bootstrap = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom'; import {MotionConfig} from 'motion/react'; import {Navigation} from './src/app/components/navigation'; import {CareerGrowthPage} from './src/app/components/career-growth-page'; createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><MemoryRouter initialEntries={[window.__growthPath]}><Navigation /><CareerGrowthPage /></MemoryRouter></MotionConfig>);`;
const bundle = await build({ stdin: { contents: bootstrap, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, format: "iife", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "offline-growth-fixtures", setup(builder) {
  builder.onLoad({ filter: /[\\/]lib[\\/]api\.ts$/ }, () => ({ contents: `const fixtures=${JSON.stringify(fixtures)}; export const api={get:async(url)=>{if(!(url in fixtures))throw new Error('Unexpected fixture '+url);return {data:fixtures[url]}},post:async()=>({data:{}}),put:async()=>({data:{}}),delete:async()=>({data:{}})};`, loader: "js" }));
  builder.onLoad({ filter: /[\\/]auth-provider\.tsx$/ }, () => ({ contents: `export const useAuth=()=>({session:{access_token:'offline-fixture',user:{id:'fixture-user'}},loading:false});`, loader: "js" }));
  builder.onLoad({ filter: /[\\/]lib[\\/]supabase\.ts$/ }, () => ({ contents: `export const supabase={auth:{signOut:async()=>({error:null})}};`, loader: "js" }));
  builder.onResolve({ filter: /^next-themes$/ }, () => ({ path: "offline-theme", namespace: "growth-qa" }));
  builder.onLoad({ filter: /.*/, namespace: "growth-qa" }, () => ({ contents: `export const useTheme=()=>({theme:window.__growthTheme,setTheme:()=>{}});`, loader: "js" }));
} }] });
const assets = await readdir(".verification-dist/assets");
const styles = (await Promise.all(assets.filter(name => name.endsWith(".css")).map(name => readFile(path.join(".verification-dist/assets", name), "utf8")))).join("\n");
assert(styles.length > 1000, "Build production CSS first.");
await mkdir("test-results/career-growth", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
let checked = 0;
try {
  for (const theme of ["light", "dark"]) {
    for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }, { width: 1024, height: 768 }, { width: 1440, height: 1000 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => route.abort());
      for (const tab of ["assessments", "planner", "jobs", "interview", "passport", "contacts"]) {
        const js = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
        await page.setContent(`<!doctype html><html class="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body><div id="root"></div><script>window.__growthPath=${JSON.stringify(`/career/growth?tab=${tab}&workspace=1`)};window.__growthTheme=${JSON.stringify(theme)};</script><script>${js}</script></body></html>`);
        await page.getByRole("heading", { name: "Career Growth", exact: true }).waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].every(node => !node.textContent.includes("Working")));
        if (tab === "interview") await page.getByRole("button", { name: "Resume conversation" }).click();
        const metrics = await page.evaluate(() => {
          const main = document.querySelector("main");
          const body = getComputedStyle(document.body);
          const inputs = [...document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),select,textarea')];
          return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            width: main.getBoundingClientRect().width, color: body.color, background: body.backgroundColor, font: body.fontFamily,
            unlabeled: inputs.filter(input => !input.labels?.length && !input.getAttribute("aria-label")).length,
            smallButtons: [...document.querySelectorAll("button")].filter(button => { const rect = button.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.height < 43; }).length };
        });
        assert(!metrics.overflow, `${tab}/${theme}/${viewport.width}: horizontal overflow`);
        assert(metrics.width <= viewport.width, `${tab}: viewport fit`);
        assert(metrics.font.includes("system-ui"), `${tab}: consistent system typography`);
        assert(metrics.unlabeled === 0, `${tab}: unlabeled form controls`);
        assert(metrics.smallButtons === 0, `${tab}/${theme}/${viewport.width}: small button targets`);
        await page.screenshot({ path: `test-results/career-growth/${tab}-${theme}-${viewport.width}.png`, fullPage: true });
        checked += 1;
      }
      await page.close();
    }
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
  process.stdout.write(`${checked} offline browser layout checks passed across all six sections with shared navigation, both themes, phone portrait/landscape, tablet, and desktop.\n`);
} finally { await browser.close(); }

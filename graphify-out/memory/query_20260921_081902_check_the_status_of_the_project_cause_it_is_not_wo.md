---
type: "query"
date: "2026-09-21T08:19:02.281130+00:00"
question: "check the status of the project cause it is not working"
contributor: "graphify"
outcome: "useful"
source_nodes: ["dependencies", "build", "App()", "Backend Dependency Manifest", "Frontend main.tsx Module Entry", "test_phase_one.py"]
---

# Q: check the status of the project cause it is not working

## Answer

Expanded from original query via graph vocab: [status, app, frontend, backend, build, error, dependencies, config, runtime, test]. Current local checkout is healthy: both services start, backend health returns 200, 84 frontend tests pass, 104 backend tests pass, 4 browser tests pass, and the production build succeeds. The strongest failure cause is deployment drift: remote main is 58ee93d while local HEAD is 8a59c03 and 59 tracked files differ, with additional untracked files. The Vercel configuration builds only the frontend, while local VITE_API_BASE_URL points to localhost:8000, so a hosted frontend will fail unless the backend is separately deployed and the production API URL is configured. Supabase Auth and JWKS endpoints return 200 and frontend/backend project configuration matches.

## Outcome

- Signal: useful

## Source Nodes

- dependencies
- build
- App()
- Backend Dependency Manifest
- Frontend main.tsx Module Entry
- test_phase_one.py
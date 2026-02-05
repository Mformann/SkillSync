## Backend (FastAPI)

**Stack**
- **Framework**: FastAPI
- **Database**: SQLite (via SQLAlchemy)
- **Auth**: JWT (access token) with password hashing (bcrypt)

### Project layout

- `app/main.py` – FastAPI application factory and router registration
- `app/database.py` – SQLAlchemy engine/session and `init_db` helper
- `app/models.py` – ORM models (`User`, `Analysis`)
- `app/schemas.py` – Pydantic schemas for requests/responses
- `app/auth_utils.py` – Password hashing, JWT token utilities, and `get_current_user` dependency
- `app/services/analysis_service.py` – Resume parsing, skill extraction, and data shaping for dashboard/analysis/gap report/roadmap
- `app/routers/`
  - `auth.py` – signup, login, and current user endpoints
  - `resume.py` – resume upload, analysis, gap report, and roadmap endpoints
  - `dashboard.py` – dashboard summary endpoint

### Install & run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

### Key endpoints

- `POST /auth/signup` – create a new user
- `POST /auth/login-json` – JSON body login (`{ "email", "password" }`) returning `access_token`
- `GET /auth/me` – current user profile (requires `Authorization: Bearer <token>`)
- `POST /resume/upload` – upload a resume file (`file`) and optional `job_role` (multipart form), returns `analysis_id`
- `GET /resume/analysis/{analysis_id}` – analysis data for charts
- `GET /resume/gap-report/{analysis_id}` – gap report and strengths/gaps
- `GET /resume/roadmap/{analysis_id}` – learning roadmap
- `GET /dashboard/summary` – dashboard summary based on latest analysis


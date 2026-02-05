from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import auth, resume, dashboard


def create_app() -> FastAPI:
  app = FastAPI(title="AI Resume & Skill Gap Analyzer API")

  # CORS for local Vite dev and production deployments
  origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",
  ]

  app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
  )

  @app.on_event("startup")
  def on_startup() -> None:
    init_db()

  app.include_router(auth.router, prefix="/auth", tags=["auth"])
  app.include_router(resume.router, prefix="/resume", tags=["resume"])
  app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])

  return app


app = create_app()


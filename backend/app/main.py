import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .database import init_db
from .routers import analysis, auth, career, learning, optimization, resume, resume_studio, workspaces
from .security import ProductionSafetyMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title="SkillSync API",
        description="Resume and target-job workspace API.",
        version="1.0.0",
    )

    origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(ProductionSafetyMiddleware)

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()

    @app.get("/health", tags=["System"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "skillsync-api"}

    app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
    app.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
    app.include_router(learning.router, prefix="/learning", tags=["Learning"])
    app.include_router(resume.router, prefix="/resume", tags=["Resume"])
    app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
    app.include_router(resume_studio.router, prefix="/resume-studio", tags=["Resume Studio"])
    app.include_router(career.router, prefix="/career", tags=["Career Hub"])
    app.include_router(optimization.router, prefix="/product", tags=["Career Vault and Privacy"])
    return app


app = create_app()

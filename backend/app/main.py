from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from .config import api_docs_enabled, cors_origins, is_production, validate_runtime_configuration
from .database import engine, init_db
from .routers import analysis, auth, career, dashboard, growth, learning, optimization, resume, resume_studio, workspaces
from .security import ProductionSafetyMiddleware


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        validate_runtime_configuration()
        # Local development remains zero-setup. Production schema changes are
        # applied by the deployment release command (Alembic), not create_all.
        if not is_production():
            init_db()
        yield

    docs_enabled = api_docs_enabled()
    app = FastAPI(
        title="SkillSync API",
        description="Resume and target-job workspace API.",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(ProductionSafetyMiddleware)

    @app.get("/health", tags=["System"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "skillsync-api"}

    @app.get("/health/ready", tags=["System"])
    def readiness() -> dict[str, str]:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Database is unavailable.") from exc
        return {"status": "ready", "service": "skillsync-api"}

    app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
    app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
    app.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
    app.include_router(learning.router, prefix="/learning", tags=["Learning"])
    app.include_router(resume.router, prefix="/resume", tags=["Resume"])
    app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
    app.include_router(resume_studio.router, prefix="/resume-studio", tags=["Resume Studio"])
    app.include_router(career.router, prefix="/career", tags=["Career Hub"])
    app.include_router(growth.router, prefix="/growth", tags=["Career Growth"])
    app.include_router(optimization.router, prefix="/product", tags=["Career Vault and Privacy"])
    return app


app = create_app()

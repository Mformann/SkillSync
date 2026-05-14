from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db
from .routers import auth, resume, analysis

def create_app() -> FastAPI:
    app = FastAPI()

    origins = [
    "http://localhost:3000",  # React
    "http://localhost:5173",  # Vite/Vue/Svelte
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows these origins
    allow_credentials=True,
    allow_methods=["*"],    # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],    # Allows all headers
)

    @app.on_event("startup")
    def on_startup():
        init_db()

    # ✅ Set prefixes ONLY here
    app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
    app.include_router(resume.router, prefix="/resume", tags=["Resume"])
    app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])

    return app

app = create_app()
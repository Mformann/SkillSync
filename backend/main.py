from fastapi import FastAPI
from backend.app.routers import resume, analysis
from fastapi.middleware.cors import CORSMiddleware

import os

app = FastAPI()

# Configure CORS
allow_origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(resume.router, prefix="/resume", tags=["Resume"])
app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Resume Analyzer Backend!"}
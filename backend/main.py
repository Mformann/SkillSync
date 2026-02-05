from fastapi import FastAPI
from backend.app.routers import auth, resume, analysis

app = FastAPI()

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(resume.router, prefix="/resume", tags=["Resume"])
app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Resume Analyzer Backend!"}
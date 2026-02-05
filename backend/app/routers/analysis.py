from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class SkillGapRequest(BaseModel):
    skills: list[str]
    job_requirements: list[str]

@router.post("/skill-gap-analysis")
def skill_gap_analysis(request: SkillGapRequest):
    missing_skills = [skill for skill in request.job_requirements if skill not in request.skills]
    return {"missing_skills": missing_skills, "message": "Skill gap analysis completed."}
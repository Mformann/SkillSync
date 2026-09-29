from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..auth_utils import AuthenticatedUser, get_current_user

router = APIRouter()

class SkillGapRequest(BaseModel):
    skills: list[str]
    job_requirements: list[str]

@router.post("/skill-gap-analysis")
def skill_gap_analysis(request: SkillGapRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
    missing_skills = [skill for skill in request.job_requirements if skill not in request.skills]
    return {"missing_skills": missing_skills, "message": "Skill gap analysis completed."}

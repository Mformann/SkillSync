from typing import Any, Dict, List

from pydantic import BaseModel

# --- Dashboard Schemas ---
class DashboardSummary(BaseModel):
    stats: List[Dict[str, Any]]
    progressData: List[Dict[str, Any]]
    recentActivity: List[Dict[str, Any]]
    weeklyGoals: List[Dict[str, Any]]
    achievements: List[Dict[str, Any]]

# --- Analysis Schemas (✅ MUST BE CAMELCASE) ---
class AnalysisResponse(BaseModel):
    overview: Dict[str, Any]
    skillDistribution: List[Dict[str, Any]] # Was skill_distribution
    topSkills: List[Dict[str, Any]]        # Was top_skills
    competencyData: List[Dict[str, Any]]    # Was competency_data
    skillCategories: List[Dict[str, Any]]   # Was skill_categories
    recommendations: List[Dict[str, Any]]

# --- Gap Report Schemas ---
class GapReportResponse(BaseModel):
    summaryCards: List[Dict[str, Any]]
    gapAnalysis: List[Dict[str, Any]]
    strengthsVsGaps: Dict[str, Any]
    targetRoles: List[Dict[str, Any]]

# --- Roadmap Schemas ---
class RoadmapResponse(BaseModel):
    overviewStats: List[Dict[str, Any]]
    overallProgress: Dict[str, Any]
    roadmap: List[Dict[str, Any]]

class ResumeUploadResponse(BaseModel):
    analysis_id: int
    workspace_id: int
    resume_id: int
    message: str

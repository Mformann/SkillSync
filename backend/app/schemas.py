from datetime import datetime
from typing import List, Optional, Any, Dict

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
  name: str
  email: EmailStr
  password: str


class UserOut(BaseModel):
  id: int
  name: str
  email: EmailStr
  created_at: datetime

  class Config:
    from_attributes = True


class Token(BaseModel):
  access_token: str
  token_type: str = "bearer"


class TokenData(BaseModel):
  user_id: int
  email: EmailStr


class LoginRequest(BaseModel):
  email: EmailStr
  password: str


class DashboardSummary(BaseModel):
  stats: List[Dict[str, Any]]
  progress_data: List[Dict[str, Any]]
  recent_activity: List[Dict[str, Any]]
  weekly_goals: List[Dict[str, Any]]
  achievements: List[Dict[str, Any]]


class AnalysisResponse(BaseModel):
  overview: Dict[str, Any]
  skill_distribution: List[Dict[str, Any]]
  top_skills: List[Dict[str, Any]]
  competency_data: List[Dict[str, Any]]
  skill_categories: List[Dict[str, Any]]
  recommendations: List[Dict[str, Any]]


class GapReportResponse(BaseModel):
  summary_cards: List[Dict[str, Any]]
  gap_analysis: List[Dict[str, Any]]
  strengths_vs_gaps: Dict[str, Any]
  target_roles: List[Dict[str, Any]]


class RoadmapResponse(BaseModel):
  overview_stats: List[Dict[str, Any]]
  overall_progress: Dict[str, Any]
  roadmap: List[Dict[str, Any]]


class ResumeUploadResponse(BaseModel):
  analysis_id: int
  message: str


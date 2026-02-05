from __future__ import annotations

import io
from typing import List, Tuple

from PyPDF2 import PdfReader
from docx import Document


KNOWN_SKILLS = [
  # Technical
  "javascript",
  "typescript",
  "react",
  "node",
  "python",
  "sql",
  "docker",
  "kubernetes",
  "graphql",
  "aws",
  "azure",
  "gcp",
  "ci/cd",
  "microservices",
  "testing",
  "jest",
  "cypress",
  "graphql",
  "fastapi",
  "django",
  "flask",
  "git",
  "html",
  "css",
]


def extract_text_from_pdf(data: bytes) -> str:
  reader = PdfReader(io.BytesIO(data))
  text_chunks: List[str] = []
  for page in reader.pages:
    text_chunks.append(page.extract_text() or "")
  return "\n".join(text_chunks)


def extract_text_from_docx(data: bytes) -> str:
  document = Document(io.BytesIO(data))
  return "\n".join(p.text for p in document.paragraphs)


def parse_resume(file_bytes: bytes, content_type: str) -> str:
  if content_type == "application/pdf":
    return extract_text_from_pdf(file_bytes)
  if content_type in {
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }:
    return extract_text_from_docx(file_bytes)
  # Fallback: best-effort decode
  try:
    return file_bytes.decode("utf-8", errors="ignore")
  except Exception:
    return ""


def extract_skills(text: str) -> Tuple[List[str], List[str]]:
  """
  Very simple skill extraction: look for known skills in the resume text.
  Returns (found_skills, missing_skills).
  """
  lower = text.lower()
  found = sorted({skill for skill in KNOWN_SKILLS if skill in lower})
  missing = sorted(skill for skill in KNOWN_SKILLS if skill not in found)
  return found, missing


def build_dashboard_summary(found_skills: List[str]) -> dict:
  total_known = len(KNOWN_SKILLS)
  total_found = len(found_skills)
  match_pct = int((total_found / max(total_known, 1)) * 100)
  gaps = total_known - total_found

  stats = [
    {
      "label": "Skill Match",
      "value": f"{match_pct}%",
      "icon": "Target",
      "color": "text-primary",
      "bgColor": "bg-primary/10",
      "trend": "+5%",
    },
    {
      "label": "Total Skills",
      "value": str(total_found),
      "icon": "BarChart3",
      "color": "text-cyan-500",
      "bgColor": "bg-cyan-500/10",
      "trend": f"+{max(total_found - 5, 0)}",
    },
    {
      "label": "Skill Gaps",
      "value": str(gaps),
      "icon": "AlertCircle",
      "color": "text-amber-500",
      "bgColor": "bg-amber-500/10",
      "trend": "-2",
    },
    {
      "label": "Strengths",
      "value": str(total_found - max(gaps, 0)),
      "icon": "CheckCircle2",
      "color": "text-green-500",
      "bgColor": "bg-green-500/10",
      "trend": "+4",
    },
  ]

  # Simple mocked time-series, trending up with match_pct
  base = max(50, match_pct - 15)
  progress_data = [
    {"month": "Jan", "score": base},
    {"month": "Feb", "score": base + 3},
    {"month": "Mar", "score": base + 6},
    {"month": "Apr", "score": base + 9},
    {"month": "May", "score": base + 11},
    {"month": "Jun", "score": match_pct},
  ]

  recent_activity = [
    {"action": "Resume uploaded", "date": "just now", "status": "completed"},
    {"action": "Skill analysis generated", "date": "just now", "status": "completed"},
    {"action": "Gap report created", "date": "just now", "status": "completed"},
    {"action": "Learning roadmap ready", "date": "just now", "status": "new"},
  ]

  weekly_goals = [
    {"goal": "Review core backend skills", "progress": 40, "total": 100, "completed": False},
    {"goal": "Practice system design", "progress": 20, "total": 100, "completed": False},
    {"goal": "Update portfolio projects", "progress": 100, "total": 100, "completed": True},
  ]

  achievements = [
    {"title": "First Upload", "icon": "Upload", "unlocked": True},
    {"title": "Skill Explorer", "icon": "Trophy", "unlocked": total_found >= 10},
    {"title": "Fast Learner", "icon": "Zap", "unlocked": match_pct >= 70},
    {"title": "Goal Crusher", "icon": "Target", "unlocked": False},
  ]

  return {
    "stats": stats,
    "progressData": progress_data,
    "recentActivity": recent_activity,
    "weeklyGoals": weekly_goals,
    "achievements": achievements,
  }


def build_analysis_data(found_skills: List[str], missing_skills: List[str]) -> dict:
  # For now, treat first half of found_skills as "strong"
  strong = found_skills[: max(len(found_skills) // 2, 1)]
  developing = found_skills[max(len(found_skills) // 2, 1) :]
  missing_top = missing_skills[:4]

  skill_distribution = [
    {"name": "Technical Skills", "value": max(len(found_skills), 1) * 3},
    {"name": "Soft Skills", "value": 28},
    {"name": "Industry Knowledge", "value": 18},
    {"name": "Certifications", "value": 12},
  ]

  top_skills = [
    {"skill": s.capitalize(), "level": 70 + (i * 5) % 30}
    for i, s in enumerate(found_skills[:6])
  ] or [
    {"skill": "JavaScript", "level": 80},
    {"skill": "React", "level": 78},
  ]

  competency_data = [
    {"category": "Frontend", "score": 80},
    {"category": "Backend", "score": 72},
    {"category": "Database", "score": 65},
    {"category": "DevOps", "score": 58},
    {"category": "Testing", "score": 70},
    {"category": "Design", "score": 62},
  ]

  skill_categories = [
    {
      "title": "Strong Skills",
      "type": "strong",
      "skills": strong or ["JavaScript", "React"],
    },
    {
      "title": "Developing Skills",
      "type": "developing",
      "skills": developing or ["Node.js", "SQL"],
    },
    {
      "title": "Missing Skills",
      "type": "missing",
      "skills": missing_top or ["Kubernetes", "GraphQL", "CI/CD"],
    },
  ]

  overview = {
    "overallScore": 75,
    "totalSkills": len(found_skills),
    "resumeStrength": "Good",
    "jobMatchRate": 80,
  }

  recommendations = [
    {
      "title": "Leverage Your Strengths",
      "body": "Highlight your strongest technical skills prominently in your resume summary.",
    },
    {
      "title": "Balance Your Skill Set",
      "body": "Invest in backend, DevOps, and testing to become a more well-rounded engineer.",
    },
    {
      "title": "Close Critical Gaps",
      "body": "Focus on modern tooling like Kubernetes and CI/CD to match senior role expectations.",
    },
  ]

  return {
    "overview": overview,
    "skillDistribution": skill_distribution,
    "topSkills": top_skills,
    "competencyData": competency_data,
    "skillCategories": skill_categories,
    "recommendations": recommendations,
  }


def build_gap_report(found_skills: List[str], missing_skills: List[str]) -> dict:
  gap_analysis = [
    {"skill": s.capitalize(), "current": 20 + i * 5, "target": 80, "priority": "High"}
    for i, s in enumerate(missing_skills[:6])
  ] or [
    {"skill": "Kubernetes", "current": 20, "target": 85, "priority": "High"},
  ]

  summary_cards = [
    {"label": "Strong Skills", "value": len(found_skills)},
    {"label": "Skill Gaps", "value": len(missing_skills)},
    {"label": "High Priority", "value": min(3, len(missing_skills))},
    {"label": "Est. Learning Time", "value": "3-4m"},
  ]

  strengths = [
    {"skill": s.capitalize(), "level": "Advanced", "years": "2+"} for s in found_skills[:5]
  ] or [
    {"skill": "JavaScript", "level": "Expert", "years": "4+"},
  ]

  gaps = [
    {"skill": s.capitalize(), "impact": "High", "demandTrend": "Growing"}
    for s in missing_skills[:4]
  ] or [
    {"skill": "Kubernetes", "impact": "High", "demandTrend": "Growing"},
  ]

  strengths_vs_gaps = {"strengths": strengths, "gaps": gaps}

  target_roles = [
    {
      "title": "Full Stack Developer",
      "matchScore": 70 + min(len(found_skills), 10),
      "missingSkills": missing_skills[:4],
      "timeToReady": "3-4 months",
    },
    {
      "title": "Senior Frontend Developer",
      "matchScore": 80 + min(len([s for s in found_skills if s in {"react", "typescript"}]), 10),
      "missingSkills": ["Advanced TypeScript", "Testing"],
      "timeToReady": "1-2 months",
    },
  ]

  return {
    "summaryCards": summary_cards,
    "gapAnalysis": gap_analysis,
    "strengthsVsGaps": strengths_vs_gaps,
    "targetRoles": target_roles,
  }


def build_roadmap(missing_skills: List[str]) -> dict:
  phases = []
  chunks = [missing_skills[i : i + 3] for i in range(0, len(missing_skills), 3)] or [
    ["Docker", "Kubernetes", "CI/CD"],
  ]

  for index, chunk in enumerate(chunks[:4]):
    phase_number = index + 1
    phases.append(
      {
        "phase": f"Phase {phase_number}",
        "title": "Skill Development",
        "duration": "3-5 weeks",
        "status": "in-progress" if index == 0 else "upcoming",
        "progress": 40 if index == 0 else 0,
        "skills": [s.capitalize() for s in chunk],
        "milestones": [],
      }
    )

  overview_stats = [
    {"label": "Total Duration", "value": "12-20w"},
    {"label": "Completed", "value": "0"},
    {"label": "In Progress", "value": "1"},
    {"label": "Certifications", "value": "1"},
  ]

  overall_progress = {"percent": 10}

  return {"overviewStats": overview_stats, "overallProgress": overall_progress, "roadmap": phases}


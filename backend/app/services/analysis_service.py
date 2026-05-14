from __future__ import annotations
import io
from typing import List, Tuple
from PyPDF2 import PdfReader
from docx import Document

KNOWN_SKILLS = [
    "javascript", "typescript", "react", "node", "python", "sql", "docker", 
    "kubernetes", "graphql", "aws", "azure", "gcp", "ci/cd", "microservices", 
    "testing", "jest", "cypress", "fastapi", "django", "flask", "git", "html", "css"
]

def parse_resume(file_bytes: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if "word" in content_type or "officedocument" in content_type:
        document = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in document.paragraphs)
    try:
        return file_bytes.decode("utf-8", errors="ignore")
    except:
        return ""

def extract_skills(text: str) -> Tuple[List[str], List[str]]:
    lower = text.lower()
    found = sorted({s for s in KNOWN_SKILLS if s in lower})
    missing = sorted(s for s in KNOWN_SKILLS if s not in found)
    return found, missing

def build_dashboard_summary(found_skills: List[str]) -> dict:
    match_pct = int((len(found_skills) / len(KNOWN_SKILLS)) * 100) if KNOWN_SKILLS else 0
    return {
        "stats": [
            {"label": "Skill Match", "value": f"{match_pct}%", "icon": "Target", "color": "text-primary", "bgColor": "bg-primary/10", "trend": "+5%"},
            {"label": "Total Skills", "value": str(len(found_skills)), "icon": "BarChart3", "color": "text-cyan-500", "bgColor": "bg-cyan-500/10", "trend": "+2"}
        ],
        "progressData": [{"month": "Jan", "score": 65}, {"month": "Jun", "score": match_pct}],
        "recentActivity": [{"action": "Resume analyzed", "date": "Just now", "status": "completed"}],
        "weeklyGoals": [{"goal": "Study Kubernetes", "progress": 45, "total": 100, "completed": False}],
        "achievements": [{"title": "Skill Expert", "icon": "Trophy", "unlocked": True}]
    }

def build_analysis_data(found_skills: List[str], missing_skills: List[str]) -> dict:
    return {
        "overview": {
            "overallScore": 78, 
            "totalSkills": len(found_skills), 
            "resumeStrength": "Good", 
            "jobMatchRate": 82
        },
        "skillDistribution": [
            {"name": "Technical", "value": len(found_skills)},
            {"name": "Soft Skills", "value": 5},
            {"name": "Knowledge", "value": 3}
        ],
        "topSkills": [{"skill": s.capitalize(), "level": 85} for s in found_skills[:5]],
        "competencyData": [
            {"category": "Frontend", "score": 85}, 
            {"category": "Backend", "score": 70}, 
            {"category": "DevOps", "score": 40}, 
            {"category": "Testing", "score": 60}
        ],
        "skillCategories": [
            {"title": "Technical Skills", "icon": "Code", "color": "text-primary", "bgColor": "bg-primary/10", "skills": found_skills},
            {"title": "Missing Skills", "icon": "AlertTriangle", "color": "text-red-500", "bgColor": "bg-red-500/10", "skills": missing_skills[:5]}
        ],
        "recommendations": [
            {"title": "Leverage Strengths", "body": f"Focus on your {', '.join(found_skills[:2] if found_skills else ['core'])} skills."},
            {"title": "Bridge Gaps", "body": "Learn modern DevOps tools to improve your score."}
        ]
    }

def build_gap_report(found_skills: List[str], missing_skills: List[str]) -> dict:
    return {
        "summaryCards": [
            {"label": "Strong Skills", "value": len(found_skills)}, 
            {"label": "Skill Gaps", "value": len(missing_skills)}
        ],
        "gapAnalysis": [
            {"skill": s.capitalize(), "current": 20, "target": 85, "priority": "High"} 
            for s in missing_skills[:6]
        ],
        "strengthsVsGaps": {
            "strengths": [{"skill": s.capitalize(), "level": "Expert", "years": "3+"} for s in found_skills[:4]],
            "gaps": [{"skill": s.capitalize(), "impact": "High", "demandTrend": "Growing"} for s in missing_skills[:4]]
        },
        "targetRoles": [
            {"title": "Full Stack Dev", "matchScore": 78, "missingSkills": missing_skills[:3], "timeToReady": "3 months"}
        ]
    }

def build_roadmap(missing_skills: List[str]) -> dict:
    return {
        "overviewStats": [{"label": "Total Duration", "value": "12-16w"}],
        "overallProgress": {"percent": 15},
        "roadmap": [
            {
                "phase": "Phase 1", 
                "title": "Foundation", 
                "duration": "4 weeks", 
                "status": "in-progress", 
                "progress": 30,
                "skills": [s.capitalize() for s in missing_skills[:3]],
                "milestones": []
            }
        ]
    }
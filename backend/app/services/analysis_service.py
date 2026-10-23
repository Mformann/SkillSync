from __future__ import annotations
from typing import List, Tuple
from .document_parser import parse_resume  # Backwards-compatible import for callers.

KNOWN_SKILLS = [
    "javascript", "typescript", "react", "node", "python", "sql", "docker", 
    "kubernetes", "graphql", "aws", "azure", "gcp", "ci/cd", "microservices", 
    "testing", "jest", "cypress", "fastapi", "django", "flask", "git", "html", "css"
]

def extract_skills(text: str) -> Tuple[List[str], List[str]]:
    lower = text.lower()
    found = sorted({s for s in KNOWN_SKILLS if s in lower})
    missing = sorted(s for s in KNOWN_SKILLS if s not in found)
    return found, missing

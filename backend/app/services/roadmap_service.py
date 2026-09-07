from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

STATUS_GAP = {"partial_match", "transferable", "poorly_demonstrated", "missing_evidence", "missing_skill"}
STATUS_MULTIPLIER = {
    "partial_match": 0.45,
    "transferable": 0.55,
    "poorly_demonstrated": 0.35,
    "missing_evidence": 0.3,
    "missing_skill": 1.0,
}
CATEGORY_HOURS = {
    "technical_skill": 12,
    "soft_skill": 6,
    "experience": 8,
    "education": 10,
    "certification": 16,
    "domain_knowledge": 10,
    "responsibility": 7,
}
PREREQUISITES = {
    "react": ["JavaScript", "HTML", "CSS"],
    "typescript": ["JavaScript"],
    "node": ["JavaScript"],
    "kubernetes": ["Docker"],
    "graphql": ["APIs"],
    "fastapi": ["Python", "HTTP APIs"],
    "django": ["Python", "SQL"],
    "cypress": ["JavaScript", "Testing fundamentals"],
    "jest": ["JavaScript", "Testing fundamentals"],
    "aws": ["Cloud fundamentals"],
    "azure": ["Cloud fundamentals"],
    "gcp": ["Cloud fundamentals"],
}
RESOURCES = {
    "react": {"title": "React Learn", "url": "https://react.dev/learn", "provider": "React", "free": True},
    "javascript": {"title": "MDN JavaScript Guide", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", "provider": "MDN", "free": True},
    "typescript": {"title": "TypeScript Handbook", "url": "https://www.typescriptlang.org/docs/handbook/intro.html", "provider": "TypeScript", "free": True},
    "html": {"title": "MDN Learn HTML", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content", "provider": "MDN", "free": True},
    "css": {"title": "MDN Learn CSS", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics", "provider": "MDN", "free": True},
    "python": {"title": "The Python Tutorial", "url": "https://docs.python.org/3/tutorial/", "provider": "Python", "free": True},
    "docker": {"title": "Docker Get Started", "url": "https://docs.docker.com/get-started/", "provider": "Docker", "free": True},
    "kubernetes": {"title": "Kubernetes Basics", "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/", "provider": "Kubernetes", "free": True},
    "sql": {"title": "SQL learning path", "url": "https://learn.microsoft.com/en-us/training/browse/?terms=SQL", "provider": "Microsoft Learn", "free": True},
    "azure": {"title": "Azure learning paths", "url": "https://learn.microsoft.com/en-us/training/azure/", "provider": "Microsoft Learn", "free": True},
    "aws": {"title": "AWS Skill Builder", "url": "https://skillbuilder.aws/", "provider": "AWS", "free": True},
    "git": {"title": "Git documentation", "url": "https://git-scm.com/doc", "provider": "Git", "free": True},
}
GENERIC_RESOURCE = {
    "title": "Search free learning modules",
    "url": "https://learn.microsoft.com/en-us/training/",
    "provider": "Microsoft Learn",
    "free": True,
}

from urllib.parse import quote_plus

YOUTUBE_RESOURCES: dict[str, list[dict[str, str]]] = {
    "react": [
        {"title": "React 19 & Full Course for Beginners", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=bMknfKXIFA8", "duration": "Full Course"},
        {"title": "React Crash Course & Practical Components", "channel": "Traversy Media", "url": "https://www.youtube.com/watch?v=LDB4uaJ87e0", "duration": "Crash Course"},
    ],
    "javascript": [
        {"title": "JavaScript Programming - Full Beginner's Course", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=PkZNo7MFNFg", "duration": "Full Course"},
        {"title": "JavaScript in 100 Seconds & Core Architecture", "channel": "Fireship", "url": "https://www.youtube.com/watch?v=DHjqpvDnNGE", "duration": "Quick Deep Dive"},
    ],
    "typescript": [
        {"title": "TypeScript Full Course for Beginners", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=BwuLxPH8IDs", "duration": "Full Course"},
        {"title": "No BS TS - Practical TypeScript Series", "channel": "Jack Herrington", "url": "https://www.youtube.com/playlist?list=PLNqp92_EXZBJYFr8eqCXxTUCZESAgNyAu", "duration": "Tutorial Series"},
    ],
    "python": [
        {"title": "Python for Beginners - Full Tutorial", "channel": "Programming with Mosh", "url": "https://www.youtube.com/watch?v=_uQrJ0TkZlc", "duration": "Full Course"},
        {"title": "Python OOP & Modular Application Tutorials", "channel": "Corey Schafer", "url": "https://www.youtube.com/playlist?list=PL-osiE80TeTskrapNbzXhCoUxC3ZQuctY", "duration": "In-Depth Series"},
    ],
    "docker": [
        {"title": "Docker Tutorial for Beginners (Full Course)", "channel": "TechWorld with Nana", "url": "https://www.youtube.com/watch?v=3c-iBn73dDE", "duration": "Full Course"},
        {"title": "Docker in 100 Seconds & Container Walkthrough", "channel": "Fireship", "url": "https://www.youtube.com/watch?v=Gjnup-PuquQ", "duration": "Crash Course"},
    ],
    "kubernetes": [
        {"title": "Kubernetes Tutorial for Beginners", "channel": "TechWorld with Nana", "url": "https://www.youtube.com/watch?v=X48VuDVv0do", "duration": "Complete Tutorial"},
        {"title": "Complete Kubernetes Bootcamp & Labs", "channel": "Kunal Kushwaha", "url": "https://www.youtube.com/watch?v=KVBON1lA9N8", "duration": "Hands-on Bootcamp"},
    ],
    "sql": [
        {"title": "SQL Tutorial - Full Database Course for Beginners", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=HXV3zeQKqGY", "duration": "Full Course"},
        {"title": "SQL for Backend Devs & Complex Query Analysis", "channel": "Alex The Analyst", "url": "https://www.youtube.com/watch?v=7mz73uXD9DA", "duration": "Practical Walkthrough"},
    ],
    "aws": [
        {"title": "AWS Certified Cloud Practitioner & Hands-on Architecture", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=SOTamWNgDKc", "duration": "Full Course"},
        {"title": "AWS Basics for Developers", "channel": "Fireship", "url": "https://www.youtube.com/watch?v=r4YIdn2eTm4", "duration": "Architecture Guide"},
    ],
    "azure": [
        {"title": "Microsoft Azure Fundamentals (AZ-900) Course", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=NKEFWyqJ5XA", "duration": "Full Course"},
        {"title": "Azure Master Class Technical Walkthrough", "channel": "John Savill's Technical Training", "url": "https://www.youtube.com/playlist?list=PLlVtbbG169nGlGPWs9wyLRS844W2_Pnx3", "duration": "Hands-on Series"},
    ],
    "git": [
        {"title": "Git and GitHub for Beginners - Full Crash Course", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=RGOj5yH7evk", "duration": "Complete Guide"},
        {"title": "Git in 100 Seconds & Advanced Branching", "channel": "Fireship", "url": "https://www.youtube.com/watch?v=hwP7mwU4ycM", "duration": "Quick Overview"},
    ],
    "fastapi": [
        {"title": "FastAPI Full Course for Beginners (Python API)", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=0sOvCWFmrtA", "duration": "Full Course"},
    ],
    "django": [
        {"title": "Python Django Tutorial: Build a Full-Featured Web App", "channel": "Corey Schafer", "url": "https://www.youtube.com/playlist?list=PL-osiE80TeTtoQCKZ03TU5fNfx2UY6U4p", "duration": "Project Series"},
    ],
    "testing": [
        {"title": "JavaScript Testing & Jest Crash Course", "channel": "Traversy Media", "url": "https://www.youtube.com/watch?v=7r4xVDI2vho", "duration": "Crash Course"},
        {"title": "Cypress End-to-End Testing Full Course", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=u8vMu7vi9Ag", "duration": "E2E Testing"},
    ],
    "html": [
        {"title": "HTML Full Course for Beginners", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=kUMe1FH4CHE", "duration": "Crash Course"},
    ],
    "css": [
        {"title": "CSS Tutorial - Zero to Hero with Flexbox & Grid", "channel": "Kevin Powell", "url": "https://www.youtube.com/watch?v=1Rs2ND1ryYc", "duration": "Complete Guide"},
    ],
    "graphql": [
        {"title": "GraphQL Full Course - Beginner to Pro", "channel": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=ed8SzALpx1Q", "duration": "API Course"},
    ],
}

PRACTICAL_TESTS: dict[str, dict[str, Any]] = {
    "react": {
        "micro_challenge": "Build an interactive counter and search-filter component using useState, useEffect, and custom hooks.",
        "project_deliverable": "A responsive dashboard card with live data fetching, loading skeletons, error handling, and debounced search.",
        "checklist": [
            "Properly manages asynchronous data fetching without memory leaks",
            "Includes loading skeletons, empty states, and user-friendly error banners",
            "Demonstrates clean component decomposition with TypeScript types",
            "Zero unhandled console warnings during state updates and re-renders",
        ],
    },
    "typescript": {
        "micro_challenge": "Refactor a plain JavaScript utility library to strict TypeScript with interfaces, generics, and discriminated unions.",
        "project_deliverable": "A strongly typed API client module with generic response wrappers and runtime validation schemas.",
        "checklist": [
            "Strict mode enabled (noImplicitAny, strictNullChecks)",
            "Uses generics and utility types (Partial, Pick, Omit) where appropriate",
            "No 'any' escapes in core business logic",
            "TypeScript compiler passes with 0 diagnostic errors",
        ],
    },
    "python": {
        "micro_challenge": "Write a clean CLI script that processes JSON/CSV files, parses command line arguments, and writes formatted reports.",
        "project_deliverable": "A modular data extraction and transformation service with unit tests and type annotations.",
        "checklist": [
            "Uses Python type hints and docstrings",
            "Implements structured error handling and logging",
            "Includes at least 3 unit tests using pytest",
            "Follows PEP 8 style and formatting guidelines",
        ],
    },
    "docker": {
        "micro_challenge": "Write a multi-stage Dockerfile that minimizes image size and runs as a non-root user.",
        "project_deliverable": "A complete docker-compose.yml multi-container environment (Web, API, and DB) with volume persistence.",
        "checklist": [
            "Docker image builds cleanly without cache bloat (< 150MB runtime)",
            "Containers start and communicate over a dedicated bridge network",
            "Database data persists across docker compose down and up",
            "Environment variables are securely injected via .env file",
        ],
    },
    "sql": {
        "micro_challenge": "Write analytical SQL queries using JOINs, GROUP BY, HAVING, and window functions (ROW_NUMBER, RANK).",
        "project_deliverable": "A relational database schema migration with indexed queries for complex analytical reporting.",
        "checklist": [
            "Schema includes primary keys, foreign keys, and cascading constraints",
            "Query plan (EXPLAIN ANALYZE) demonstrates index utilization",
            "Aggregations produce verified results against edge-case test rows",
            "No full table scans on frequently filtered columns",
        ],
    },
    "fastapi": {
        "micro_challenge": "Build a REST API endpoint with Pydantic request validation and dependency injection for auth.",
        "project_deliverable": "A CRUD microservice with async database queries, automated Swagger docs, and JWT authentication.",
        "checklist": [
            "All endpoints define strict Pydantic request and response schemas",
            "Proper HTTP status codes returned (200, 201, 400, 404, 422, 500)",
            "Dependency injection used for DB session and authentication",
            "Unit tests verify both authenticated and unauthenticated requests",
        ],
    },
}


def _youtube_resources_for(skill: str) -> list[dict[str, str]]:
    lowered = skill.casefold()
    for key, videos in YOUTUBE_RESOURCES.items():
        if key in lowered:
            return [v.copy() for v in videos]
    
    encoded_search = quote_plus(f"{skill} tutorial practical crash course")
    return [
        {
            "title": f"Watch {skill} Tutorials & Crash Courses",
            "channel": "Top YouTube Educators",
            "url": f"https://www.youtube.com/results?search_query={encoded_search}",
            "duration": "Curated Search",
        },
        {
            "title": f"{skill} Hands-on Real World Project Guide",
            "channel": "YouTube Dev Community",
            "url": f"https://www.youtube.com/results?search_query={quote_plus(f'{skill} practical project tutorial')}",
            "duration": "Project Walkthrough",
        },
    ]


def _practical_test_for(skill: str, role_title: str = "target role") -> dict[str, Any]:
    lowered = skill.casefold()
    for key, test in PRACTICAL_TESTS.items():
        if key in lowered:
            return test.copy()
    return {
        "micro_challenge": f"Create a working sample script or component that demonstrates core {skill} principles in 1-2 hours.",
        "project_deliverable": f"Build a reviewable demo or portfolio feature proving {skill} in a context relevant to the {role_title} role.",
        "checklist": [
            f"Demonstrates practical usage of {skill} according to modern industry conventions",
            "Includes clear README instructions on how to install, configure, and execute",
            "Demonstrates error handling, validation, and edge case consideration",
            "Code is committed to a public Git repository with a clear commit history",
        ],
    }


def _resource_for(skill: str) -> dict[str, Any]:
    lowered = skill.casefold()
    doc_resource = next((value for key, value in RESOURCES.items() if key in lowered), GENERIC_RESOURCE).copy()
    doc_resource["youtube"] = _youtube_resources_for(skill)
    return doc_resource


def build_plan_tasks(
    explainable_data: dict,
    hours_per_week: float,
    target_date: date,
    experience_level: str,
    start_date: date | None = None,
) -> list[dict]:
    start = start_date or date.today()
    requirements = {item["name"].casefold(): item for item in explainable_data.get("requirements", [])}
    candidates = []
    for match in explainable_data.get("matches", []):
        if match.get("status") not in STATUS_GAP:
            continue
        requirement = requirements.get(match.get("requirement_name", "").casefold())
        if not requirement:
            continue
        importance = int(requirement.get("importance", 3))
        required_multiplier = 1.5 if requirement.get("priority") == "required" else 1.0
        gap_multiplier = 1 - {
            "partial_match": .65, "transferable": .55, "poorly_demonstrated": .4,
            "missing_evidence": .2, "missing_skill": 0,
        }[match["status"]]
        proof_value = 1.2 if requirement.get("category") == "technical_skill" else 1.0
        priority = round(importance * required_multiplier * gap_multiplier * proof_value, 2)
        base_hours = CATEGORY_HOURS.get(requirement.get("category"), 8)
        level_factor = {"beginner": 1.3, "intermediate": 1.0, "advanced": .75}.get(experience_level, 1.0)
        estimated = max(2, round(base_hours * STATUS_MULTIPLIER[match["status"]] * level_factor, 1))
        skill = requirement["name"]
        practical = _practical_test_for(skill)
        resource_obj = _resource_for(skill)
        resource_obj["practical_test"] = practical
        candidates.append({
            "skill": skill,
            "title": f"Build job-ready evidence for {skill}",
            "category": requirement.get("category", "technical_skill"),
            "priority_score": priority,
            "estimated_hours": estimated,
            "prerequisites": PREREQUISITES.get(skill.casefold(), []),
            "resource": resource_obj,
            "objective": match.get("recommended_action") or f"Demonstrate practical {skill} ability.",
            "project_brief": practical["project_deliverable"],
            "assessment_criteria": " | ".join(practical["checklist"]),
        })

    # Dependency-sensitive ordering: fewer prerequisites first, then job impact.
    candidates.sort(key=lambda item: (len(item["prerequisites"]), -item["priority_score"]))
    available_days = max(1, (target_date - start).days)
    total_hours = sum(item["estimated_hours"] for item in candidates)
    capacity = max(hours_per_week, .5) * max(available_days / 7, 1 / 7)
    compression = min(1.0, capacity / total_hours) if total_hours else 1.0
    cumulative_hours = 0.0
    for index, item in enumerate(candidates, start=1):
        cumulative_hours += item["estimated_hours"] * compression
        days_needed = math.ceil((cumulative_hours / max(hours_per_week, .5)) * 7)
        item["order_index"] = index
        item["due_date"] = min(target_date, start + timedelta(days=max(1, days_needed)))
    return candidates


def plan_progress(tasks: list[Any]) -> int:
    total = sum(float(task.estimated_hours) for task in tasks)
    earned = sum(float(task.estimated_hours) * int(task.progress) / 100 for task in tasks)
    return round(earned / total * 100) if total else 0


def readiness_label(tasks: list[Any], target_date: date) -> str:
    progress = plan_progress(tasks)
    overdue = sum(1 for task in tasks if task.due_date < date.today() and task.progress < 100)
    if progress >= 80:
        return "Apply now"
    if overdue:
        return "Schedule at risk"
    if (target_date - date.today()).days <= 14:
        return "Apply while learning"
    return "Build evidence first"

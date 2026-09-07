from __future__ import annotations

import re

GAP_STATUSES = {"missing_skill", "missing_evidence", "poorly_demonstrated"}


def generate_interview_questions(explainable: dict, job_title: str) -> list[dict]:
    requirements = {item.get("name", "").casefold(): item for item in explainable.get("requirements", [])}
    questions = []
    for match in explainable.get("matches", []):
        skill = match.get("requirement_name", "this requirement")
        requirement = requirements.get(skill.casefold(), {})
        status = match.get("status")
        if status in GAP_STATUSES:
            prompt = f"How would you approach a {skill} challenge in the {job_title} role despite the current evidence gap?"
            focus = f"Show an honest learning plan or transferable example for {skill}; do not claim experience you do not have."
        else:
            prompt = f"Tell me about a specific time you applied {skill} and what changed because of your work."
            focus = f"Use the verified resume evidence for {skill}, then explain your action and measurable result."
        questions.append({
            "id": f"q-{len(questions) + 1}", "requirement": skill, "status": status,
            "question": prompt, "focus": focus, "priority": requirement.get("priority", "preferred"),
        })
    questions.sort(key=lambda item: (item["priority"] != "required", item["status"] not in GAP_STATUSES))
    return questions[:8]


def score_practice_answer(answer: str) -> dict:
    words = answer.split()
    lower = answer.casefold()
    structure_terms = sum(bool(re.search(rf"\b{term}\b", lower)) for term in ("situation", "task", "action", "result"))
    evidence_terms = sum(bool(re.search(rf"\b{term}\b", lower)) for term in ("built", "created", "improved", "reduced", "increased", "delivered", "learned"))
    specificity = min(100, len(words) * 2)
    structure = min(100, structure_terms * 25)
    evidence = min(100, evidence_terms * 20 + (20 if re.search(r"\d", answer) else 0))
    overall = round(specificity * 0.35 + structure * 0.35 + evidence * 0.30)
    feedback = []
    if len(words) < 50:
        feedback.append("Add enough context for the interviewer to understand the problem and your contribution.")
    if structure_terms < 3:
        feedback.append("Make the Situation, Task, Action, and Result more explicit.")
    if evidence_terms < 2:
        feedback.append("Use concrete actions and outcomes; only include metrics you can verify.")
    if not feedback:
        feedback.append("Strong structure. Rehearse it aloud and keep every claim supportable.")
    return {"overall": overall, "specificity": specificity, "structure": structure, "evidence": evidence, "feedback": feedback}


def readiness_summary(analysis, plan, evidence_count: int, sessions: list, has_resume: bool) -> dict:
    score_data = analysis.score_breakdown or {}
    match = int(score_data.get("overall", 0))
    learning = 0
    if plan and plan.tasks:
        learning = round(sum(task.progress for task in plan.tasks) / len(plan.tasks))
    portfolio = min(100, evidence_count * 25)
    practice_scores = [
        value.get("overall", 0)
        for session in sessions for value in (session.scores or {}).values()
        if isinstance(value, dict)
    ]
    interview = round(sum(practice_scores) / len(practice_scores)) if practice_scores else 0
    materials = 100 if has_resume else 0
    total = round(match * 0.35 + learning * 0.25 + portfolio * 0.15 + interview * 0.15 + materials * 0.10)
    components = {"job_match": match, "learning": learning, "portfolio": portfolio, "interview": interview, "materials": materials}
    weakest = min(components, key=components.get)
    labels = {
        "job_match": "Improve job alignment from the evidence analysis.",
        "learning": "Continue the prioritized learning roadmap.",
        "portfolio": "Add verifiable projects, demos, or case studies.",
        "interview": "Complete a grounded interview-practice answer.",
        "materials": "Create and review a tailored resume version.",
    }
    return {"overall": total, "components": components, "next_best_action": labels[weakest], "formula_version": "career-readiness-v1"}

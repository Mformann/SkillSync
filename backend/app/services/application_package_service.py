from __future__ import annotations

import re

NUMBER_RE = re.compile(r"(?<!\w)\d+(?:[.,]\d+)?%?(?!\w)")


def build_application_package(analysis, profile=None, achievements=None) -> tuple[dict, dict, list]:
    data = analysis.explainable_data or {}
    workspace = analysis.target_job
    matches = [
        item for item in data.get("matches", [])
        if item.get("status") in {"strong_match", "partial_match", "transferable"} and item.get("evidence_quotes")
    ]
    sources = {}
    evidence_lines = []
    for match in matches[:5]:
        key = f"resume-{len(evidence_lines) + 1}"
        quote = match["evidence_quotes"][0].strip()
        evidence_lines.append((match.get("requirement_name", ""), quote, key))
        sources[key] = {"type": "resume", "quote": quote, "requirement": match.get("requirement_name", "")}
    relevant_achievements = []
    requirement_names = {item.get("requirement_name", "").casefold() for item in data.get("matches", [])}
    for achievement in achievements or []:
        if achievement.skills and not ({skill.casefold() for skill in achievement.skills} & requirement_names):
            continue
        key = f"achievement-{achievement.id}"
        relevant_achievements.append(achievement)
        sources[key] = {
            "type": "user_attested", "quote": achievement.statement,
            "source_note": achievement.source_note, "source_url": achievement.source_url,
        }
    name = (profile.full_name if profile else None) or "Candidate"
    company = workspace.company or "your organization"
    skills = [skill for skill, _, _ in evidence_lines]
    proof = " ".join(f"My resume documents: {quote}" for _, quote, _ in evidence_lines[:2])
    attested = (
        f" My Career Vault also contains this user-attested achievement: {relevant_achievements[0].statement}"
        if relevant_achievements else ""
    )
    cover_letter = (
        f"Dear Hiring Team,\n\nI am applying for the {workspace.title} role at {company}. "
        f"My documented experience aligns with {', '.join(skills[:4]) or 'the role requirements'}. "
        f"{proof}{attested}\n\nI would welcome the opportunity to discuss how this evidence can support your team.\n\nSincerely,\n{name}"
    )
    outreach = (
        f"Hello, I am interested in the {workspace.title} opportunity at {company}. "
        f"My resume contains direct evidence related to {', '.join(skills[:3]) or 'the role requirements'}. "
        "Would you be open to a brief conversation about the team's priorities?"
    )
    follow_up = (
        f"Hello, I am following up on my application for the {workspace.title} role at {company}. "
        "I remain interested and would be glad to provide additional evidence or work samples. "
        "Thank you for your consideration."
    )
    content = {"cover_letter": cover_letter, "recruiter_outreach": outreach, "follow_up": follow_up}
    warnings = []
    if not evidence_lines:
        warnings.append({"severity": "high", "message": "No verified resume evidence was available; personalize before use."})
    if not profile or not profile.full_name:
        warnings.append({"severity": "medium", "message": "Complete your Career Vault profile to personalize the package."})
    if relevant_achievements:
        warnings.append({"severity": "medium", "message": "Review user-attested Career Vault achievements and their source before sending."})
    return content, sources, warnings


def package_warnings(content: dict, source_map: dict) -> list[dict]:
    source_numbers = set()
    for source in source_map.values():
        source_numbers.update(NUMBER_RE.findall(source.get("quote", "")))
    warnings = []
    for section, text in content.items():
        unsupported = set(NUMBER_RE.findall(str(text))) - source_numbers
        if unsupported:
            warnings.append({
                "severity": "high", "section": section,
                "message": f"Verify unsupported metric(s): {', '.join(sorted(unsupported))}.",
            })
    return warnings

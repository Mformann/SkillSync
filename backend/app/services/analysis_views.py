"""Read-only projections of current evidence. Saved sample JSON is never trusted."""
from dataclasses import dataclass
from itertools import chain

from pydantic import ValidationError

from .ai_analysis_service import AIAnalysis, SCORING_VERSION, STATUS_SCORES, calculate_scores, ground_analysis
from .analysis_runs import derived_is_stale, inputs, result_is_stale

PROJECTION_VERSION = "evidence-views-v1"
COMPLETED = {"completed_ai", "completed_fallback", "completed_cached"}
NOTICES = {
    "empty": "Upload a resume and target job to begin.",
    "pending": "Run this job analysis to calculate a match.",
    "processing": "This job analysis is still processing.",
    "stale": "The inputs or processing preferences changed. Run the current analysis.",
    "legacy": "This saved analysis needs reanalysis before its scores can be shown reliably.",
    "failed": "The last run did not finish. Retry the analysis explicitly.",
    "unavailable": "No evaluable job requirements were found. Review the job description and run the analysis again.",
}


@dataclass(frozen=True)
class View:
    status: str
    result: AIAnalysis | None = None
    scores: dict | None = None

    def metadata(self, analysis=None):
        return {"analysis_id": analysis.id if analysis else None, "status": self.status,
                "notice": NOTICES.get(self.status), "projection_version": PROJECTION_VERSION,
                "formula_version": SCORING_VERSION}


def current_view(analysis):
    if analysis is None:
        return View("empty")
    status = analysis.analysis_status or "pending"
    if status == "pending" and not analysis.explainable_data and analysis.analysis_data:
        return View("legacy")
    if status == "stale":
        return View("stale")
    if status in {"pending", "processing", "failed"}:
        return View(status)
    if not analysis.explainable_data or not analysis.input_hash:
        return View("legacy")
    if result_is_stale(analysis):
        return View("stale")
    if status not in COMPLETED:
        return View("legacy")
    try:
        result = ground_analysis(AIAnalysis.model_validate(analysis.explainable_data), inputs(analysis)[1])
    except (ValidationError, ValueError, TypeError):
        return View("legacy")
    if not result.requirements:
        return View("unavailable")
    return View(status, result, calculate_scores(result))


def ranked_items(view):
    if view.result is None:
        return []
    matches = {item.requirement_name.casefold(): item for item in view.result.matches}
    return sorted(((requirement, matches[requirement.name.casefold()]) for requirement in view.result.requirements),
                  key=lambda pair: (pair[0].priority != "required", -pair[0].importance,
                                    STATUS_SCORES[pair[1].status], pair[0].name.casefold()))


def history_item(analysis):
    view = current_view(analysis)
    return {"id": analysis.id, "filename": analysis.resume_filename,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "score": view.scores["overall"] if view.scores is not None else None,
            "completed": view.result is not None, **view.metadata(analysis)}


def gap_report(analysis):
    view = current_view(analysis)
    items = ranked_items(view)
    gaps = [(req, match) for req, match in items if match.status != "strong_match"]
    supported = [(req, match) for req, match in items if match.evidence_quotes and match.status in
                 {"strong_match", "partial_match", "transferable"}]
    overall = view.scores["overall"] if view.scores is not None else None
    return {**view.metadata(analysis),
        "summaryCards": [{"label": "Overall evidence match", "value": overall},
                         {"label": "Job requirements", "value": len(items)},
                         {"label": "Supported requirements", "value": len(supported)},
                         {"label": "Requirements to improve", "value": len(gaps)}],
        "gapAnalysis": [{"skill": req.name, "priority": req.priority.title(), "importance": req.importance,
                         "current": round(100 * STATUS_SCORES[match.status]),
                         "target": 100 - round(100 * STATUS_SCORES[match.status]),
                         "status": match.status, "action": match.recommended_action,
                         "evidence": match.evidence_quotes} for req, match in gaps],
        "strengthsVsGaps": {
            "strengths": [{"skill": req.name, "level": match.status.replace("_", " ").capitalize(),
                           "evidence": match.evidence_quotes} for req, match in supported],
            "gaps": [{"skill": req.name, "impact": req.priority.title(), "action": match.recommended_action}
                     for req, match in gaps]},
        "targetRoles": ([{"title": analysis.target_job.title if analysis.target_job else analysis.job_role,
                          "matchScore": overall, "missingSkills": [req.name for req, _ in gaps]}]
                        if view.result is not None else []),
    }


def analysis_report(analysis):
    view = current_view(analysis)
    items = ranked_items(view)
    supported = [(req, match) for req, match in items if match.evidence_quotes]
    gaps = [(req, match) for req, match in items if match.status != "strong_match"]
    return {**view.metadata(analysis),
        "overview": {"overallScore": view.scores["overall"] if view.scores else None,
                     "totalSkills": len(items), "resumeStrength": "Evidence comparison" if items else "Unavailable",
                     "jobMatchRate": view.scores["overall"] if view.scores else None},
        "skillDistribution": [{"name": category.replace("_", " "),
                               "value": sum(req.category == category for req, _ in supported)}
                              for category in sorted({req.category for req, _ in items})],
        "topSkills": [{"skill": req.name, "status": match.status, "evidence": match.evidence_quotes}
                      for req, match in supported],
        "competencyData": [],
        "skillCategories": [{"title": "Supported requirements", "skills": [req.name for req, _ in supported]},
                            {"title": "Requirements to improve", "skills": [req.name for req, _ in gaps]}],
        "recommendations": [{"title": req.name, "body": match.recommended_action} for req, match in gaps],
    }


def roadmap_report(analysis):
    view = current_view(analysis)
    plan = analysis.learning_plan
    usable = bool(plan and view.result is not None and not derived_is_stale(analysis, plan.source_input_hash))
    tasks = list(plan.tasks) if usable else []
    return {**view.metadata(analysis), "overviewStats": [],
            "overallProgress": {"percent": round(sum(task.progress for task in tasks) / len(tasks)) if tasks else None},
            "roadmap": [{"phase": str(task.order_index), "title": task.title, "status": task.status,
                         "progress": task.progress, "skills": [task.skill], "milestones": [],
                         "estimated_hours": task.estimated_hours, "due_date": task.due_date} for task in tasks]}


def dashboard_summary(analyses):
    iterator = iter(analyses)
    latest = next(iterator, None)
    view = current_view(latest)
    total = completed = score_sum = 0
    points, activity = [], []
    for analysis in chain([latest] if latest else [], iterator):
        total += 1
        item = view if analysis is latest else current_view(analysis)
        if len(activity) < 5:
            activity.append({"action": "Resume comparison", "date": analysis.created_at.isoformat(), "status": item.status})
        if item.scores is not None:
            completed += 1
            score_sum += item.scores["overall"]
            if len(points) < 50:
                points.append({"analysis_id": analysis.id, "date": (analysis.analyzed_at or analysis.created_at).isoformat(), "score": item.scores["overall"]})
    latest_score = view.scores["overall"] if view.scores is not None else None
    gaps = gap_report(latest)["gapAnalysis"] if latest else []
    plan = latest.learning_plan if latest else None
    tasks = {task.skill.casefold(): task for task in plan.tasks} if (
        plan and not derived_is_stale(latest, plan.source_input_hash)) else {}
    goals = []
    for gap in gaps[:3]:
        task = tasks.get(gap["skill"].casefold())
        goals.append({"id": f'{latest.id}:{gap["skill"].casefold()}', "goal": f'{gap["skill"]}: {gap["action"]}', "skill": gap["skill"],
                      "analysis_id": latest.id, "priority": gap["priority"],
                      "progress": task.progress if task else 0, "total": 100,
                      "completed": bool(task and task.status == "completed")})
    return {**view.metadata(latest),
        "stats": [{"label": "Latest Score", "value": latest_score},
                  {"label": "Total Resumes", "value": total},
                  {"label": "Avg Score", "value": round(score_sum / completed) if completed else None},
                  {"label": "Analysis Done", "value": completed}],
        "progressData": list(reversed(points)),
        "recentActivity": activity,
        "weeklyGoals": goals, "achievements": []}

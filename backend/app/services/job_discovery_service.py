"""Read-only imports from official public Greenhouse and Lever job APIs.

Never fetch an arbitrary user-provided URL, follow redirects, or scrape a board.
"""
import html
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlsplit

import httpx

from .growth_service import QUESTION_BANK


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.ignore = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.ignore += 1
        elif tag in {"p", "br", "li", "div", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.ignore = max(0, self.ignore - 1)

    def handle_data(self, data):
        if not self.ignore:
            self.parts.append(data)


def plain_text(value: str) -> str:
    parser = TextExtractor()
    parser.feed(html.unescape(value or ""))
    return re.sub(r"[ \t]+", " ", "".join(parser.parts)).strip()[:50_000]


def safe_public_url(value: str | None) -> str | None:
    try:
        parts = urlsplit(value or "")
        if parts.scheme == "https" and parts.hostname and not parts.username and not parts.password and parts.port in (None, 443):
            return value
    except ValueError:
        pass
    return None


def job_locator(url: str) -> tuple[str, str, str, bool]:
    try:
        parts = urlsplit(url)
        if parts.scheme != "https" or parts.username or parts.password or parts.port not in (None, 443):
            raise ValueError()
        host = parts.hostname
        if host in {"boards.greenhouse.io", "job-boards.greenhouse.io"}:
            match = re.fullmatch(r"/([a-zA-Z0-9_-]{1,80})/jobs/(\d{1,20})/?", parts.path)
            if match:
                return "greenhouse", match[1], match[2], False
        if host in {"jobs.lever.co", "jobs.eu.lever.co"}:
            match = re.fullmatch(r"/([a-zA-Z0-9_-]{1,80})/([a-zA-Z0-9-]{1,80})/?", parts.path)
            if match:
                return "lever", match[1], match[2], host == "jobs.eu.lever.co"
        if host == "boards.greenhouse.io" and parts.path == "/embed/job_app":
            query = parse_qs(parts.query)
            board, job = query.get("for", [""])[0], query.get("token", [""])[0]
            if re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", board) and re.fullmatch(r"\d{1,20}", job):
                return "greenhouse", board, job, False
    except (ValueError, IndexError):
        pass
    raise ValueError("Use a public Greenhouse or Lever job link. For other sites, paste the description manually.")


def fetch_json(url: str):
    # Every caller constructs a fixed API hostname and validated path components.
    with httpx.Client(timeout=12, follow_redirects=False, trust_env=False) as client:
        with client.stream("GET", url, headers={"Accept": "application/json"}) as response:
            response.raise_for_status()
            if response.is_redirect:
                raise ValueError("The job source redirected. Open the job board and use its current link.")
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > 4_000_000:
                    raise ValueError("The job source response is too large.")
            return json.loads(content)


def normalize_job(provider: str, board: str, item: dict, eu: bool = False) -> dict:
    if provider == "greenhouse":
        title = item.get("title", "")
        location = (item.get("location") or {}).get("name", "")
        description = plain_text(item.get("content", ""))
        url = item.get("absolute_url")
        salary = None
    else:
        title = item.get("text", "")
        location = (item.get("categories") or {}).get("location", "")
        description = plain_text(item.get("descriptionPlain") or item.get("description", ""))
        for section in item.get("lists", [])[:20]:
            description += "\n" + plain_text(section.get("text", "")) + "\n" + plain_text(section.get("content", ""))
        description += "\n" + plain_text(item.get("additionalPlain") or item.get("additional", ""))
        url = item.get("hostedUrl")
        salary = item.get("salaryRange")
    url = safe_public_url(url)
    if not isinstance(title, str) or not title.strip() or not url:
        raise ValueError("Job source did not return a valid title and HTTPS URL.")
    skills = [skill for skill in QUESTION_BANK if re.search(rf"\b{re.escape(skill)}\b", description, re.I)]
    return {"source": provider, "source_id": f"{provider}:{board}:{item.get('id')}",
            "title": title.strip()[:160], "company": board[:160], "location": str(location)[:160],
            "description": description.strip()[:50_000], "url": url, "salary": salary,
            "skills": skills, "remote": bool(re.search(r"\bremote\b", str(location), re.I)) or item.get("workplaceType") == "remote",
            "employment_type": str((item.get("categories") or {}).get("commitment", ""))[:80],
            "updated_at": item.get("updated_at"), "salary_disclaimer": "Salary may be missing; confirm currency, period, and eligibility on the original listing."}


def import_job(url: str) -> dict:
    provider, board, job, eu = job_locator(url)
    lever_host = "api.eu.lever.co" if eu else "api.lever.co"
    api = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{job}" if provider == "greenhouse" else f"https://{lever_host}/v0/postings/{board}/{job}?mode=json"
    item = fetch_json(api)
    if not isinstance(item, dict):
        raise ValueError("Job source did not return a job record.")
    return normalize_job(provider, board, item, eu)


_feed_cache = {}
_feed_lock = threading.Lock()


def configured_feeds() -> list[tuple[str, str]]:
    sources = []
    for provider, variable in (("greenhouse", "JOB_FEED_GREENHOUSE_BOARDS"), ("lever", "JOB_FEED_LEVER_COMPANIES")):
        for name in os.getenv(variable, "").split(","):
            name = name.strip()
            if re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", name):
                sources.append((provider, name))
    return list(dict.fromkeys(sources))[:6]


def discover_jobs() -> dict:
    sources = configured_feeds()
    cache_key = tuple(sources)
    with _feed_lock:
        cached = _feed_cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < 300:
            return cached[1]
    jobs, errors = [], []
    def read_source(source):
        provider, board = source
        found, error = [], None
        api = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true" if provider == "greenhouse" else f"https://api.lever.co/v0/postings/{board}?mode=json&limit=100"
        try:
            data = fetch_json(api)
            rows = data.get("jobs", []) if provider == "greenhouse" else data
            if not isinstance(rows, list):
                raise ValueError("Invalid source response")
            for item in rows[:100]:
                try:
                    found.append(normalize_job(provider, board, item))
                except (ValueError, AttributeError, TypeError):
                    continue
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            error = f"{provider}/{board} is temporarily unavailable."
        return found, error
    if sources:
        with ThreadPoolExecutor(max_workers=6) as pool:
            for found, error in pool.map(read_source, sources):
                jobs.extend(found)
                if error:
                    errors.append(error)
    result = {"configured": bool(sources), "jobs": jobs, "errors": errors,
              "sources": [f"{provider}/{board}" for provider, board in sources], "cache_seconds": 300}
    with _feed_lock:
        _feed_cache.clear()
        _feed_cache[cache_key] = (time.monotonic(), result)
    return result


def rank_jobs(jobs: list[dict], preferences: dict, demonstrated: set[str]) -> list[dict]:
    ranked = []
    for job in jobs:
        title = job["title"].casefold()
        roles = preferences.get("roles", [])
        if roles and not any(role.casefold() in title for role in roles):
            continue
        locations = preferences.get("locations", [])
        if preferences.get("remote_only") and not job["remote"]:
            continue
        if locations and not job["remote"] and not any(loc.casefold() in job["location"].casefold() for loc in locations):
            continue
        skills = job["skills"]
        matches = [s for s in skills if s.casefold() in demonstrated]
        gaps = [s for s in skills if s.casefold() not in demonstrated]
        score = round(100 * len(matches) / len(skills)) if skills else None
        salary = job.get("salary") or {}
        minimum = preferences.get("minimum_salary")
        salary_known = (isinstance(salary, dict) and salary.get("currency", "").upper() == preferences.get("currency", "USD")
                        and salary.get("interval") in {"year", "yearly", "annual"} and isinstance(salary.get("max"), (int, float)))
        if minimum and salary_known and salary["max"] < minimum:
            continue
        ranked.append({**job, "alignment": score, "matched_skills": matches, "missing_skills": gaps,
                       "salary_needs_review": bool(minimum) and not salary_known,
                       "explanation": f"{len(matches)} of {len(skills)} recognized skill terms have a passed SkillSync knowledge check. "
                                      "This is not an ATS score, full eligibility check, or hiring prediction."})
    return sorted(ranked, key=lambda j: j["alignment"] if j["alignment"] is not None else -1, reverse=True)[:60]

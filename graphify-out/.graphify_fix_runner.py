import json
import sys
from pathlib import Path

from graphify.cache import check_semantic_cache
from graphify.extract import collect_files, extract


ROOT = Path(".").resolve()
OUT = Path("graphify-out")
SPEC = Path(r"C:\Users\mevad\.codex\skills\graphify\references\extraction-spec.md")


def prepare_cache() -> None:
    detection = json.loads((OUT / ".graphify_detect.json").read_text(encoding="utf-8"))
    files = [
        file
        for category in ("document", "paper", "image")
        for file in detection["files"].get(category, [])
    ]
    nodes, edges, hyperedges, uncached = check_semantic_cache(
        files, root=ROOT, prompt_file=SPEC
    )
    cache_path = OUT / ".graphify_cached.json"
    if nodes or edges or hyperedges:
        cache_path.write_text(
            json.dumps({"nodes": nodes, "edges": edges, "hyperedges": hyperedges}),
            encoding="utf-8",
        )
    else:
        cache_path.unlink(missing_ok=True)
    (OUT / ".graphify_uncached.txt").write_text("\n".join(uncached), encoding="utf-8")
    print(f"Cache: {len(files) - len(uncached)} files hit, {len(uncached)} files need extraction")


def extract_code() -> None:
    detection = json.loads((OUT / ".graphify_detect.json").read_text(encoding="utf-8"))
    files = []
    for file in detection.get("files", {}).get("code", []):
        path = Path(file)
        files.extend(collect_files(path) if path.is_dir() else [path])
    result = (
        extract(files, cache_root=ROOT)
        if files
        else {"nodes": [], "edges": [], "input_tokens": 0, "output_tokens": 0}
    )
    (OUT / ".graphify_ast.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"AST: {len(result['nodes'])} nodes, {len(result['edges'])} edges")


if __name__ == "__main__":
    actions = {"cache": prepare_cache, "ast": extract_code}
    if len(sys.argv) != 2 or sys.argv[1] not in actions:
        raise SystemExit("usage: .graphify_fix_runner.py [cache|ast]")
    actions[sys.argv[1]]()

import json
import sys
from pathlib import Path

from graphify.detect import detect


out = Path("graphify-out")
out.mkdir(exist_ok=True)
out.joinpath(".graphify_python").write_text(sys.executable, encoding="utf-8")
out.joinpath(".graphify_root").write_text(str(Path(".").resolve()), encoding="utf-8")
result = detect(Path("."))
out.joinpath(".graphify_detect.json").write_text(
    json.dumps(result, ensure_ascii=False), encoding="utf-8"
)
print(f"Detected {result['total_files']} files; approximately {result['total_words']} words")

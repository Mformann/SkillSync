"""Compatibility entry point; original QA probes now run in the normal suite."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "tests"))
from test_qa_regressions import *  # noqa: F401,F403

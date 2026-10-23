"""Bounded readiness wait for the synthetic browser fixture."""
import time
import os
import httpx

timeout_seconds = int(os.getenv("QA_STARTUP_TIMEOUT_SECONDS", "45"))
if not 1 <= timeout_seconds <= 180:
    raise SystemExit("QA_STARTUP_TIMEOUT_SECONDS must be between 1 and 180.")
deadline = time.monotonic() + timeout_seconds
while time.monotonic() < deadline:
    try:
        if httpx.get("http://127.0.0.1:8011/health", timeout=2).status_code == 200:
            break
    except httpx.HTTPError:
        pass
    time.sleep(.25)
else:
    raise SystemExit(f"Browser fixture did not become healthy within {timeout_seconds} seconds")

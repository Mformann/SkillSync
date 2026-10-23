#!/bin/sh
set -eu
python -c 'from app.config import validate_runtime_configuration; validate_runtime_configuration()'
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-1}" --proxy-headers

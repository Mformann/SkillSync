FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ENVIRONMENT=production \
    ENABLE_API_DOCS=false

WORKDIR /app

RUN groupadd --system skillsync \
    && useradd --system --gid skillsync --create-home skillsync

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY --chown=skillsync:skillsync alembic.ini ./
COPY --chown=skillsync:skillsync alembic ./alembic
COPY --chown=skillsync:skillsync app ./app

USER skillsync
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/health', timeout=3)" || exit 1

CMD ["sh", "-c", "python -c 'from app.config import validate_runtime_configuration; validate_runtime_configuration()' && alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-1} --proxy-headers"]

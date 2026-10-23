FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ENVIRONMENT=production \
    ENABLE_API_DOCS=false

WORKDIR /app

RUN groupadd --system skillsync \
    && useradd --system --gid skillsync --create-home skillsync

COPY backend/requirements.lock ./
RUN python -m pip install --no-cache-dir --upgrade "pip>=26.2,<27" \
    && python -m pip install --no-cache-dir --require-hashes -r requirements.lock

COPY --chown=skillsync:skillsync backend/alembic.ini ./
COPY --chown=skillsync:skillsync backend/alembic ./alembic
COPY --chown=skillsync:skillsync backend/app ./app
COPY --chown=skillsync:skillsync backend/scripts ./scripts

USER skillsync
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/health', timeout=3)" || exit 1

CMD ["sh", "/app/scripts/start.sh"]

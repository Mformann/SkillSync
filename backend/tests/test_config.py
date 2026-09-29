import pytest

from app.config import api_docs_enabled, cors_origins, validate_runtime_configuration


def test_production_configuration_requires_postgres_and_https_origins(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./resume_analyzer.db")
    monkeypatch.setenv("SUPABASE_URL", "https://test-project.supabase.co")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        validate_runtime_configuration()

    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:password@db.example.com/skillsync",
    )
    monkeypatch.setenv("CORS_ORIGINS", "http://app.example.com")
    with pytest.raises(RuntimeError, match="Invalid CORS origin"):
        cors_origins()


def test_production_configuration_accepts_expected_settings(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:password@db.example.com/skillsync",
    )
    monkeypatch.setenv("SUPABASE_URL", "https://test-project.supabase.co")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
    monkeypatch.setenv("MAX_REQUEST_BYTES", "12582912")
    validate_runtime_configuration()


def test_production_docs_are_opt_in(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("ENABLE_API_DOCS", raising=False)
    assert api_docs_enabled() is False
    monkeypatch.setenv("ENABLE_API_DOCS", "true")
    assert api_docs_enabled() is True

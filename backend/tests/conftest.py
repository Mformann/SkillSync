"""Keep ordinary tests independent of developer credentials and hosted databases."""
import os

# Explicit integration fixtures use their separately named disposable URLs.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ENVIRONMENT"] = "development"
os.environ["GROQ_API_KEY"] = ""
os.environ["SUPABASE_URL"] = "https://fixture.supabase.co"
os.environ["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test_fixture"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

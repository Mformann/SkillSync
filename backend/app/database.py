import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import as_declarative, sessionmaker, Session
from typing import Generator

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resume_analyzer.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)


@as_declarative()
class Base:
    pass


engine = create_engine(
    DATABASE_URL,
    # For Postgres, we don't need check_same_thread
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=not DATABASE_URL.startswith("sqlite"),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    from . import models
    from . import growth_models
    Base.metadata.create_all(bind=engine)


# ✅ FIXED DEPENDENCY (FASTAPI COMPATIBLE)
def get_session() -> Generator[Session, None, None]:
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

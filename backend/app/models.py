from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
  __tablename__ = "users"

  id = Column(Integer, primary_key=True, index=True)
  email = Column(String, unique=True, index=True, nullable=False)
  name = Column(String, nullable=False)
  hashed_password = Column(String, nullable=False)
  created_at = Column(DateTime, default=datetime.utcnow)

  analyses = relationship("Analysis", back_populates="user")


class Analysis(Base):
  __tablename__ = "analyses"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
  created_at = Column(DateTime, default=datetime.utcnow)

  job_role = Column(String, nullable=True)
  resume_filename = Column(String, nullable=True)
  resume_text = Column(Text, nullable=True)

  # Stored JSON blobs for front-end friendly structures
  skills = Column(JSON, nullable=True)
  dashboard_summary = Column(JSON, nullable=True)
  analysis_data = Column(JSON, nullable=True)
  gap_report = Column(JSON, nullable=True)
  roadmap = Column(JSON, nullable=True)

  user = relationship("User", back_populates="analyses")


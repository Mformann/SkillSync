from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text, JSON, Integer

from .database import Base

class Analysis(Base):
  __tablename__ = "analyses"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(String, index=True, nullable=False) # Changed to String to hold Supabase UUID
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

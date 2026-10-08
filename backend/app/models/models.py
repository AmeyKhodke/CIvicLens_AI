"""SQLAlchemy ORM models for the Meeting Co-Pilot."""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, DateTime, Integer, Float,
    ForeignKey, Enum, JSON, Boolean
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


# ── Enums ──

class MeetingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    RECORDING = "recording"
    UPLOADED = "uploaded"
    TRANSCRIBING = "transcribing"
    TRANSCRIBED = "transcribed"
    SUMMARIZING = "summarizing"
    COMPLETED = "completed"
    FAILED = "failed"

class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ConfidentialityLevel(str, enum.Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class SummaryType(str, enum.Enum):
    EXECUTIVE = "executive"
    DETAILED = "detailed"
    VERBATIM = "verbatim"


class ActionStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ESCALATED = "escalated"


class UserRole(str, enum.Enum):
    LEADER = "leader"
    SECRETARY = "secretary"
    DEPT_HEAD = "dept_head"
    ADMIN = "admin"


class Sentiment(str, enum.Enum):
    COLLABORATIVE = "collaborative"
    CONTENTIOUS = "contentious"
    NEUTRAL = "neutral"


# ── Helper ──

def generate_uuid():
    return str(uuid.uuid4())


# ── Models ──

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    designation = Column(String(255), default="")
    department = Column(String(255), default="")
    role = Column(Enum(UserRole), default=UserRole.SECRETARY)
    contact = Column(String(50), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    meetings_created = relationship("Meeting", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="user")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(500), nullable=False)
    description = Column(Text, default="")
    date = Column(DateTime, nullable=False, default=datetime.utcnow)
    venue = Column(String(500), default="")
    platform = Column(String(100), default="")  # Teams, Zoom, In-Person
    status = Column(Enum(MeetingStatus), default=MeetingStatus.SCHEDULED)
    confidentiality = Column(Enum(ConfidentialityLevel), default=ConfidentialityLevel.INTERNAL)
    sentiment = Column(Enum(Sentiment), nullable=True)
    language = Column(String(50), default="en")
    duration_seconds = Column(Integer, nullable=True)

    # File paths
    audio_file_path = Column(String(1000), nullable=True)
    agenda_file_path = Column(String(1000), nullable=True)
    original_filename = Column(String(500), nullable=True)

    # Attendees stored as JSON array
    attendees = Column(JSON, default=list)

    # Foreign keys
    created_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="meetings_created")
    transcript_segments = relationship("TranscriptSegment", back_populates="meeting", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="meeting", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String(500), nullable=False)
    title = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt
    status = Column(Enum(DocumentStatus), default=DocumentStatus.UPLOADED)
    summary = Column(Text, nullable=True)
    language = Column(String(50), default="en")
    page_count = Column(Integer, nullable=True, default=1)
    file_size = Column(Integer, nullable=True, default=0)

    # Foreign keys
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    uploader = relationship("User")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id = Column(String, primary_key=True, default=generate_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False, index=True)
    speaker = Column(String(255), default="Unknown")
    speaker_label = Column(String(50), default="")  # SPEAKER_00, SPEAKER_01
    text = Column(Text, nullable=False)
    timestamp_start = Column(Float, nullable=True)  # seconds
    timestamp_end = Column(Float, nullable=True)
    language = Column(String(50), default="en")
    agenda_item = Column(String(500), nullable=True)
    segment_index = Column(Integer, default=0)

    # Relationships
    meeting = relationship("Meeting", back_populates="transcript_segments")


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(String, primary_key=True, default=generate_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False, index=True)
    summary_type = Column(Enum(SummaryType), default=SummaryType.DETAILED)
    language = Column(String(50), default="en")

    # Structured content
    content = Column(JSON, nullable=False, default=dict)
    # Schema: { title, date, venue, attendees, agenda_items, key_points,
    #           decisions, flagged_items, sentiment, confidentiality }

    raw_text = Column(Text, default="")  # Plain-text version
    is_finalized = Column(Boolean, default=False)
    finalized_by = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    meeting = relationship("Meeting", back_populates="summaries")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(String, primary_key=True, default=generate_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    assigned_to = Column(String(255), default="")
    assigned_to_designation = Column(String(255), default="")
    deadline = Column(DateTime, nullable=True)
    status = Column(Enum(ActionStatus), default=ActionStatus.PENDING)
    priority = Column(String(20), default="medium")  # low, medium, high, critical
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    meeting = relationship("Meeting", back_populates="action_items")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)  # CREATE, READ, UPDATE, DELETE, EXPORT
    resource_type = Column(String(100), nullable=False)  # meeting, summary, action_item
    resource_id = Column(String, nullable=True)
    details = Column(JSON, default=dict)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="audit_logs")


class RAGEvaluation(Base):
    __tablename__ = "rag_evaluations"

    id = Column(String, primary_key=True, default=generate_uuid)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    evaluated_by = Column(String, ForeignKey("users.id"), nullable=True)

    status = Column(String(50), default="completed")  # running, completed, failed
    faithfulness = Column(Float, default=0.0)
    answer_relevancy = Column(Float, default=0.0)
    context_precision = Column(Float, default=0.0)
    context_recall = Column(Float, default=0.0)
    overall_score = Column(Float, default=0.0)

    total_questions = Column(Integer, default=0)
    model_name = Column(String(100), default="Groq / LLaMA-3.3-70B")
    embedding_model = Column(String(100), default="FastDense-384 / Semantic Hash")
    top_k = Column(Integer, default=4)
    avg_retrieval_time_ms = Column(Float, default=0.0)
    avg_generation_time_ms = Column(Float, default=0.0)

    # Full structured evaluation details stored as JSON string
    details_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", backref="evaluations")
    evaluator = relationship("User")


"""Meetings router: CRUD operations for meetings."""
import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models.models import Meeting, MeetingStatus, User
from app.schemas import MeetingCreate, MeetingUpdate, MeetingOut
from app.middleware.auth import get_current_user
from app.middleware.audit import log_action
from app.config import settings

router = APIRouter(prefix="/meetings", tags=["Meetings"])


@router.post("/", response_model=MeetingOut)
async def create_meeting(
    meeting: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_meeting = Meeting(
        title=meeting.title,
        description=meeting.description,
        date=meeting.date or datetime.utcnow(),
        venue=meeting.venue,
        platform=meeting.platform,
        confidentiality=meeting.confidentiality,
        language=meeting.language,
        attendees=meeting.attendees,
        created_by=current_user.id,
        status=MeetingStatus.SCHEDULED,
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)
    log_action(db, current_user.id, "CREATE", "meeting", new_meeting.id)
    return _enrich_meeting(new_meeting)


@router.get("/", response_model=List[MeetingOut])
async def list_meetings(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Meeting)
    if status and status.strip() and status.strip().lower() not in ("all", "undefined", "none", "null", ""):
        query = query.filter(Meeting.status == status.strip())
    if search and search.strip():
        query = query.filter(Meeting.title.ilike(f"%{search.strip()}%"))
    query = query.order_by(Meeting.date.desc())
    meetings = query.offset(skip).limit(limit).all()
    return [_enrich_meeting(m) for m in meetings]


@router.get("/{meeting_id}", response_model=MeetingOut)
async def get_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    log_action(db, current_user.id, "READ", "meeting", meeting_id)
    return _enrich_meeting(meeting)


@router.put("/{meeting_id}", response_model=MeetingOut)
async def update_meeting(
    meeting_id: str,
    update: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(meeting, key, value)

    db.commit()
    db.refresh(meeting)
    log_action(db, current_user.id, "UPDATE", "meeting", meeting_id)
    return _enrich_meeting(meeting)


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()
    log_action(db, current_user.id, "DELETE", "meeting", meeting_id)
    return {"detail": "Meeting deleted"}


@router.post("/{meeting_id}/upload")
async def upload_audio(
    meeting_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Validate file type
    allowed_extensions = {".mp3", ".wav", ".m4a", ".flac", ".mp4", ".mkv", ".webm", ".ogg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")

    # Save file
    upload_dir = os.path.join(settings.upload_dir, meeting_id)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    meeting.audio_file_path = file_path
    meeting.original_filename = file.filename
    meeting.status = MeetingStatus.UPLOADED
    db.commit()
    db.refresh(meeting)

    log_action(db, current_user.id, "UPLOAD", "meeting", meeting_id,
               {"filename": file.filename})
    return {"detail": "File uploaded", "filename": file.filename, "path": file_path}


@router.post("/{meeting_id}/upload-agenda")
async def upload_agenda(
    meeting_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    upload_dir = os.path.join(settings.upload_dir, meeting_id)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"agenda_{file.filename}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    meeting.agenda_file_path = file_path
    db.commit()

    log_action(db, current_user.id, "UPLOAD_AGENDA", "meeting", meeting_id)
    return {"detail": "Agenda uploaded", "path": file_path}


def _enrich_meeting(meeting: Meeting) -> dict:
    """Add computed fields to meeting output."""
    data = {
        "id": meeting.id,
        "title": meeting.title,
        "description": meeting.description,
        "date": meeting.date,
        "venue": meeting.venue,
        "platform": meeting.platform,
        "status": meeting.status.value if meeting.status else "scheduled",
        "confidentiality": meeting.confidentiality.value if meeting.confidentiality else "internal",
        "sentiment": meeting.sentiment.value if meeting.sentiment else None,
        "language": meeting.language,
        "duration_seconds": meeting.duration_seconds,
        "original_filename": meeting.original_filename,
        "attendees": meeting.attendees or [],
        "created_by": meeting.created_by,
        "created_at": meeting.created_at,
        "updated_at": meeting.updated_at,
        "action_items_count": len(meeting.action_items) if meeting.action_items else 0,
        "has_summary": len(meeting.summaries) > 0 if meeting.summaries else False,
    }
    return data

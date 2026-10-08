"""Router for Document Upload, Summarization, and Q&A (RAG)."""
import os
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Document, DocumentStatus
from app.middleware.auth import get_current_user
from app.schemas import (
    DocumentOut, DocumentChatRequest, DocumentChatResponse,
    RAGEvaluationRequest, RAGEvaluationResponse
)
from app.services.document_service import save_and_extract_document
from app.services.rag_service import index_document, ask_document_question, ask_global_document_question
from app.services.summarization_service import _call_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])


async def process_document_background(db: Session, document_id: str, extracted_text: str):
    """Background task to vectorize document and generate a summary."""
    # Use a fresh DB session for background task to avoid session closed errors
    from app.database import SessionLocal
    bg_db = SessionLocal()
    try:
        doc = bg_db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Background task: document {document_id} not found")
            return

        # 1. Mark as PROCESSING
        doc.status = DocumentStatus.PROCESSING
        bg_db.commit()
        logger.info(f"Document {document_id} ({doc.filename}): Starting processing...")

        # 2. Generate Summary in the requested language
        doc_lang = doc.language or "en"
        from app.services.summarization_service import LANGUAGE_NAMES
        lang_name = LANGUAGE_NAMES.get(doc_lang, "English")

        logger.info(f"Document {document_id}: Generating AI summary in {lang_name}...")
        
        # Prepare text safely within LLM context budget (RAG will index the full text)
        if len(extracted_text) > 8000:
            doc_sample = extracted_text[:5000] + "\n\n[... content truncated for summary ...]\n\n" + extracted_text[-3000:]
        else:
            doc_sample = extracted_text

        if doc_lang != "en":
            system_prompt = f"You are an elite government executive analyst. Produce a concise, high-impact executive summary strictly in {lang_name}. Total length MUST be between 200 to 300 words maximum. Be direct, formal, and highlight only critical figures and decisions. Do not write excessive prose."
            user_prompt = f"""Generate a crisp, concise EXECUTIVE SUMMARY of this governance document strictly in {lang_name} (max 250-300 words).
                            Format exactly with these 4 clear sections in {lang_name}:
                            ## 📌 Overview (विहंगावलोकन / सारांश)
                            (2-3 concise sentences on document context, authority, and period)

                            ## 🔍 Key Findings (मुख्य निरीक्षणे व मुद्दे)
                            (3-4 bullet points of the most critical findings with key numbers)

                            ## 💰 Financial Highlights (आर्थिक ठळक मुद्दे)
                            (2-3 bullet points on budget, expenditure, or irregularities, if applicable)

                            ## ⚡ Key Actions & Decisions (निर्णय व कृती)
                            (2-3 concrete directives, required compliance actions, and next steps)

                            DOCUMENT CONTENT:
                            {doc_sample}"""
        else:
            system_prompt = "You are an elite government executive analyst. Produce a concise, high-impact executive summary. Total length MUST be between 200 to 300 words maximum. Be direct, formal, and highlight only critical figures and decisions. Do not write excessive prose."
            user_prompt = f"""Generate a crisp, concise EXECUTIVE SUMMARY of this governance document (max 250-300 words).

            Format exactly with these 4 clear sections:
            ## 📌 Overview
            (2-3 concise sentences on document context, issuing authority, and period)

            ## 🔍 Key Findings
            (3-4 bullet points of the most critical findings with key figures)

            ## 💰 Financial Highlights
            (2-3 bullet points on budget, expenditure, revenue, or irregularities)

            ## ⚡ Key Actions & Decisions
            (2-3 concrete directives, required compliance actions, and next steps)

            DOCUMENT CONTENT:
            {doc_sample}"""

        summary = await _call_llm(system_prompt, user_prompt)
        
        doc.summary = summary
        bg_db.commit()
        logger.info(f"Document {document_id}: Summary generated in {lang_name} ({len(summary)} chars)")

        # 3. Vectorize for RAG
        logger.info(f"Document {document_id}: Indexing for RAG...")
        meta = {"filename": doc.filename, "file_type": doc.file_type, "title": doc.title or doc.filename}
        num_chunks = await index_document(document_id, extracted_text, doc_metadata=meta)
        logger.info(f"Document {document_id}: Indexed {num_chunks} chunks")

        # 4. Mark as READY
        doc.status = DocumentStatus.READY
        bg_db.commit()
        logger.info(f"Document {document_id}: Processing complete ✅")

    except Exception as e:
        logger.exception(f"Document {document_id}: Background processing failed: {e}")
        try:
            doc = bg_db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocumentStatus.FAILED
                doc.summary = f"Processing failed: {str(e)}"
                bg_db.commit()
        except Exception as inner:
            logger.error(f"Could not update failure status: {inner}")
    finally:
        bg_db.close()


# ── IMPORTANT: literal routes must come BEFORE parameterized routes ──

@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    language: str = Form("en"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document (PDF, DOCX, TXT) and process it for summarization and Q&A."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT files are supported")
    
    db_doc, extracted_text = await save_and_extract_document(
        db=db,
        upload_file=file,
        uploaded_by=current_user.id,
        title=title,
        language=language
    )
    
    if extracted_text:
        background_tasks.add_task(process_document_background, db, db_doc.id, extracted_text)
    else:
        db_doc.status = DocumentStatus.FAILED
        db_doc.summary = "No text could be extracted from the document."
        db.commit()

    return db_doc


@router.get("/", response_model=List[DocumentOut])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all documents uploaded."""
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.post("/assistant/chat", response_model=DocumentChatResponse)
async def global_assistant_chat(
    request: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask questions across ALL processed documents (global RAG assistant)."""
    try:
        answer_data = await ask_global_document_question(
            question=request.question,
            language=request.language
        )
        return answer_data
    except Exception as e:
        logger.exception(f"Global assistant chat failed: {e}")
        raise HTTPException(status_code=500, detail=f"Assistant error: {str(e)}")


# ── Parameterized routes below ──

@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get metadata and summary of an uploaded document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/{document_id}/chat", response_model=DocumentChatResponse)
async def chat_with_document(
    document_id: str,
    request: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask questions about a specific document using RAG."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.status.value != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready for Q&A. Current status: {doc.status.value}"
        )
    
    try:
        answer_data = await ask_document_question(
            document_id=document_id,
            question=request.question,
            language=request.language,
            doc_obj=doc
        )
        return answer_data
    except Exception as e:
        logger.exception(f"Document chat failed for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document, its physical file, and its ChromaDB vector embeddings."""
    from app.services.rag_service import delete_document_vectors
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 1. Delete physical file from disk if present
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
            logger.info(f"Deleted physical file {doc.file_path}")
        except Exception as e:
            logger.warning(f"Failed to delete physical file {doc.file_path}: {e}")

    # 2. Delete ChromaDB vector embeddings
    await delete_document_vectors(document_id)

    # 3. Delete from DB
    db.delete(doc)
    db.commit()
    logger.info(f"Deleted document record {document_id} ({doc.filename})")

    return {"message": "Document deleted successfully", "id": document_id}


# ── RAGAS Evaluation Endpoints ──

@router.post("/{document_id}/evaluate", response_model=RAGEvaluationResponse)
async def evaluate_document_rag(
    document_id: str,
    request: Optional[RAGEvaluationRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Run RAGAS evaluation (Faithfulness, Answer Relevancy, Context Precision, Context Recall)
    on the document's retrieval & generation pipeline.
    """
    from app.services.evaluation_service import run_ragas_evaluation

    # RBAC check: Read-only leader cannot trigger re-evaluations
    if current_user.role and current_user.role.value == "leader":
        raise HTTPException(
            status_code=403, 
            detail="Public Leader role has read-only access. Only officers or administrators can trigger evaluations."
        )

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.status.value != "ready":
        raise HTTPException(
            status_code=400, 
            detail=f"Document is not ready for evaluation. Current status: {doc.status.value}"
        )

    custom_q = [q.model_dump() for q in request.custom_questions] if request and request.custom_questions else None
    top_k = request.top_k if request and request.top_k else 4

    try:
        eval_result = await run_ragas_evaluation(
            document_id=document_id,
            db=db,
            user_id=current_user.id,
            custom_questions=custom_q,
            top_k=top_k
        )
        return eval_result
    except Exception as e:
        logger.exception(f"RAGAS evaluation failed for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Evaluation execution error: {str(e)}")


@router.get("/{document_id}/evaluation", response_model=Optional[RAGEvaluationResponse])
async def get_document_rag_evaluation(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch the latest cached RAGAS evaluation results for a document."""
    from app.services.evaluation_service import get_latest_evaluation
    
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    eval_result = get_latest_evaluation(document_id, db)
    return eval_result

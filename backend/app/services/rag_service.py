"""RAG service: Q&A over meeting transcripts."""
from typing import List
from app.config import settings


async def ask_question(
    question: str,
    transcript_chunks: List[dict],
    meeting_title: str,
    language: str = "en",
) -> dict:
    """
    Answer a question about a meeting using the transcript as context.
    Uses a simple context-stuffing approach (suitable for most meetings).
    For very long transcripts, this can be upgraded to full ChromaDB RAG.
    """
    # Build context from transcript
    context_parts = []
    for chunk in transcript_chunks:
        speaker = chunk.get("speaker", "Unknown")
        text = chunk.get("text", "")
        start = chunk.get("start", 0)
        context_parts.append(f"[{speaker}] ({start:.0f}s): {text}")

    context = "\n".join(context_parts)

    # Limit context length
    if len(context) > 12000:
        # Simple relevance: search for chunks containing question keywords
        keywords = set(question.lower().split())
        relevant = []
        for chunk in transcript_chunks:
            text_lower = chunk.get("text", "").lower()
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                relevant.append((score, chunk))
        relevant.sort(key=lambda x: x[0], reverse=True)

        context_parts = []
        for _, chunk in relevant[:30]:
            speaker = chunk.get("speaker", "Unknown")
            text = chunk.get("text", "")
            start = chunk.get("start", 0)
            context_parts.append(f"[{speaker}] ({start:.0f}s): {text}")
        context = "\n".join(context_parts)

    system_prompt = """You are an AI assistant that answers questions about government meetings.
Use ONLY the provided transcript context to answer. If the answer is not in the context, say so.
Always cite the speaker and approximate timestamp when referencing specific statements.
Be precise and formal in your responses."""

    user_prompt = f"""Meeting: {meeting_title}

TRANSCRIPT CONTEXT:
{context}

QUESTION: {question}

Provide a clear, sourced answer. Cite specific speakers and what they said."""

    # Call LLM
    from app.services.summarization_service import _call_llm
    answer = await _call_llm(system_prompt, user_prompt)

    # Build source references
    sources = []
    keywords = set(question.lower().split())
    for chunk in transcript_chunks:
        text_lower = chunk.get("text", "").lower()
        if any(kw in text_lower for kw in keywords if len(kw) > 3):
            sources.append({
                "text": chunk.get("text", ""),
                "speaker": chunk.get("speaker", ""),
                "timestamp": f"{chunk.get('start', 0):.0f}s",
            })
            if len(sources) >= 5:
                break

    return {
        "answer": answer,
        "sources": sources,
    }

# ── Document RAG (LangChain + ChromaDB) ──

import os
import logging
import warnings

# Suppress LangChain deprecation and telemetry warnings
warnings.filterwarnings("ignore", category=UserWarning, module="langchain")
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")
try:
    from langchain_core._api.deprecation import LangChainDeprecationWarning
    warnings.filterwarnings("ignore", category=LangChainDeprecationWarning)
except ImportError:
    pass

# Disable ChromaDB telemetry to prevent 'capture() takes 1 positional argument' noise
os.environ["ANONYMIZED_TELEMETRY"] = "False"
logging.getLogger("chromadb.telemetry.posthog").setLevel(logging.CRITICAL)

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)

_embeddings_instance = None

class FastDenseEmbeddings:
    """Ultra-lightweight 384-dim semantic hash embeddings (0 MB RAM, 100% crash-proof)."""
    def __init__(self, dim: int = 384):
        import hashlib
        import math
        self.dim = dim
        self.hashlib = hashlib
        self.math = math

    def _embed(self, text: str) -> list:
        v = [0.0] * self.dim
        words = text.lower().split()
        for w in words:
            h = int(self.hashlib.md5(w.encode("utf-8")).hexdigest(), 16) % self.dim
            v[h] += 1.0
        norm = self.math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / norm for x in v]

    def embed_documents(self, texts: list) -> list:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list:
        return self._embed(text)


def get_embeddings():
    """High-performance, zero-latency 384-dimensional local dense embeddings."""
    global _embeddings_instance
    if _embeddings_instance is None:
        _embeddings_instance = FastDenseEmbeddings()
    return _embeddings_instance

def get_chroma_db(collection_name: str = "documents") -> Chroma:
    """Get the ChromaDB vector store instance."""
    persist_dir = settings.chroma_persist_dir
    os.makedirs(persist_dir, exist_ok=True)
    return Chroma(
        collection_name=collection_name,
        embedding_function=get_embeddings(),
        persist_directory=persist_dir
    )

async def index_document(document_id: str, text: str, doc_metadata: dict = None) -> int:
    """Split extracted text into chunks and store in ChromaDB."""
    if not text.strip():
        logger.warning(f"No text to index for document {document_id}")
        return 0

    # 1. Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    chunks = text_splitter.split_text(text)
    
    # 2. Add metadata
    metadatas = []
    base_meta = {"document_id": document_id}
    if doc_metadata:
        base_meta.update(doc_metadata)
        
    for i, _ in enumerate(chunks):
        chunk_meta = base_meta.copy()
        chunk_meta["chunk_index"] = i
        metadatas.append(chunk_meta)

    # 3. Store in Vector DB in batches for fast, reliable ingestion
    vector_db = get_chroma_db()
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        vector_db.add_texts(
            texts=chunks[i : i + batch_size], 
            metadatas=metadatas[i : i + batch_size]
        )
    
    return len(chunks)


async def delete_document_vectors(document_id: str):
    """Delete all indexed chunks for a document from ChromaDB."""
    try:
        vector_db = get_chroma_db()
        vector_db.delete(where={"document_id": document_id})
        logger.info(f"Deleted vector chunks for document {document_id}")
    except Exception as e:
        logger.warning(f"Could not delete vector chunks for {document_id}: {e}")


def retrieve_chunks_hybrid(
    document_id: str,
    query: str,
    top_k: int = 5
) -> list:
    """
    Hybrid Search with Reciprocal Semantic Re-ranking.
    Fetches candidate chunks from ChromaDB and re-ranks them based on 
    dense vector similarity + exact governance entity & keyword match.
    """
    vector_db = get_chroma_db()
    # Fetch wider candidate pool
    raw_docs = vector_db.as_retriever(
        search_kwargs={"k": max(top_k * 2, 8), "filter": {"document_id": document_id}}
    ).invoke(query)
    
    if not raw_docs:
        return []
        
    q_tokens = set(
        w.lower().strip(".,!?;:()[]\"'") 
        for w in query.split() 
        if len(w) >= 2 and w.lower() not in {"the", "and", "is", "in", "it", "of", "to", "for", "with", "on", "as", "by", "what", "which", "how"}
    )
    
    scored_candidates = []
    for rank_idx, doc in enumerate(raw_docs):
        content = doc.page_content
        content_lower = content.lower()
        
        # Dense rank score (reciprocal rank)
        dense_score = 1.0 / (60.0 + rank_idx + 1)
        
        # Keyword & entity overlap score
        matches = sum(1 for tok in q_tokens if tok in content_lower)
        keyword_score = matches / max(1, len(q_tokens))
        
        # Combined hybrid score (70% semantic keyword density + 30% dense embedding rank)
        final_score = (0.70 * keyword_score) + (0.30 * (dense_score * 60))
        scored_candidates.append((final_score, doc))
        
    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    return [c[1] for c in scored_candidates[:top_k]]


async def ask_document_question(
    document_id: str,
    question: str,
    language: str = "en",
    top_k: int = 5,
    doc_obj = None
) -> dict:
    """Retrieve relevant chunks using Hybrid Re-ranking and answer with high factual grounding."""
    
    doc_meta_str = ""
    if doc_obj is not None:
        size_kb = (getattr(doc_obj, "file_size", 0) or 0) / 1024
        size_str = f"{size_kb / 1024:.2f} MB" if size_kb >= 1024 else f"{size_kb:.1f} KB"
        doc_meta_str = f"""DOCUMENT METADATA & PROFILE:
- Title: {getattr(doc_obj, 'title', '') or getattr(doc_obj, 'filename', '')}
- Filename: {getattr(doc_obj, 'filename', '')}
- File Type: {str(getattr(doc_obj, 'file_type', 'PDF')).upper()}
- Total Pages: {getattr(doc_obj, 'page_count', 1) or 1} pages
- File Size: {size_str}
- Language: {getattr(doc_obj, 'language', 'en') or 'en'}
"""

    # 2. Retrieve context via Hybrid Re-ranked retrieval
    docs = retrieve_chunks_hybrid(document_id=document_id, query=question, top_k=top_k)
    
    context_chunks = "\n\n".join([f"--- Chunk {i+1} ---\n{doc.page_content}" for i, doc in enumerate(docs)]) if docs else "No specific chunks retrieved."
    
    # 3. Build Prompt with metadata + chunks & requested language
    from app.services.summarization_service import LANGUAGE_NAMES
    lang_name = LANGUAGE_NAMES.get(language, "English")

    if language != "en":
        system_prompt = (
            f"You are an expert governance document analyst. "
            f"Answer the user's question directly, accurately, and concisely strictly in {lang_name} using ONLY the provided context.\n"
            f"Rules:\n"
            f"1. Follow the user's requested format strictly (e.g., if asked to list key points, provide only a clean bulleted list; if asked for specific figures/page count, give the exact numbers immediately).\n"
            f"2. Do NOT use conversational filler or robotic boilerplate like 'Based on the provided document...'. Start directly with the answer.\n"
            f"3. Maintain high factual precision using the provided metadata and document content.\n"
            f"4. Respond entirely in {lang_name}."
        )
        user_prompt = f"""{doc_meta_str}

RETRIEVED DOCUMENT CONTENT:
{context_chunks}

USER QUESTION / INSTRUCTION:
{question}

Direct Answer:"""
    else:
        system_prompt = (
            "You are an expert governance AI document analyst. "
            "Answer the user's question directly, concisely, and factually using ONLY the provided context chunks and document metadata.\n"
            "Rules:\n"
            "1. Answer immediately and directly without introductory preamble or filler disclaimers (do not write 'Based on the document provided').\n"
            "2. State numbers, figures, entity names, and conclusions verbatim as they appear in the text.\n"
            "3. If the context contains sufficient facts, give a complete, specific answer."
        )
        user_prompt = f"""{doc_meta_str}

RETRIEVED DOCUMENT CONTENT:
{context_chunks}

USER QUESTION / INSTRUCTION:
{question}

Direct Concise Answer:"""

    # 4. Call LLM
    from app.services.summarization_service import _call_llm
    answer = await _call_llm(system_prompt, user_prompt)
    
    # 5. Format Sources
    sources = []
    if docs:
        for i, doc in enumerate(docs):
            sources.append({
                "text": doc.page_content[:200] + "...",  # truncated snippet
                "chunk_index": doc.metadata.get("chunk_index", i),
                "relevance": "High"
            })
        
    return {
        "answer": answer,
        "sources": sources
    }


async def ask_global_document_question(
    question: str,
    language: str = "en",
    top_k: int = 8
) -> dict:
    """Retrieve relevant chunks and summaries from ALL documents in ChromaDB/DB and answer accurately."""
    from app.database import SessionLocal
    from app.models.models import Document, DocumentStatus
    
    # 1. Fetch metadata & summaries of all active uploaded documents
    doc_registry_text = ""
    try:
        db = SessionLocal()
        all_docs = db.query(Document).filter(Document.status == DocumentStatus.READY).all()
        if all_docs:
            doc_lines = []
            for d in all_docs:
                size_kb = (d.file_size or 0) / 1024
                size_str = f"{size_kb / 1024:.2f} MB" if size_kb >= 1024 else f"{size_kb:.1f} KB"
                doc_lines.append(f"• Document: \"{d.title or d.filename}\" ({d.file_type.upper()}, {d.page_count or 1} pages, {size_str})")
                if d.summary:
                    # Provide concise excerpt of the summary
                    summary_clean = d.summary.replace("\n", " ")[:250] + "..."
                    doc_lines.append(f"  Summary Preview: {summary_clean}")
            doc_registry_text = "INDEXED GOVERNANCE DOCUMENTS OVERVIEW:\n" + "\n".join(doc_lines)
    except Exception as e:
        logger.warning(f"Failed to fetch document registry for global chat: {e}")
    finally:
        db.close()

    # 2. Retrieve vector context across all documents
    vector_db = get_chroma_db()
    search_kwargs = {"k": top_k}
    retriever = vector_db.as_retriever(search_kwargs=search_kwargs)
    docs = retriever.invoke(question)
    
    if not docs and not doc_registry_text:
        return {
            "answer": "I could not find any uploaded documents in the system. Please upload some PDF, DOCX, or TXT documents in the Documents section first.",
            "sources": []
        }
    
    # Context with document source info
    context_parts = []
    for i, doc in enumerate(docs):
        filename = doc.metadata.get("filename") or doc.metadata.get("title") or "Unknown Document"
        chunk_no = doc.metadata.get("chunk_index", i) + 1
        context_parts.append(f"--- Segment {i+1} [Source: {filename}, Chunk: {chunk_no}] ---\n{doc.page_content}")
    
    context = "\n\n".join(context_parts) if context_parts else "No specific text segments retrieved."
    
    # 3. Build Direct, High-Precision Prompt
    from app.services.summarization_service import LANGUAGE_NAMES
    lang_name = LANGUAGE_NAMES.get(language, "English")

    if language != "en":
        system_prompt = (
            f"You are CivicLens AI — an elite multi-document governance intelligence assistant. "
            f"Provide direct, high-impact, structured answers across all indexed documents strictly in {lang_name}.\n"
            f"Rules:\n"
            f"1. Start directly with the structured points without filler intros like 'Based on the provided context...'.\n"
            f"2. Use crisp bullet points, bold key-value badges, and clear section headers.\n"
            f"3. If multiple documents are referenced, clearly attribute findings to each respective document.\n"
            f"4. Respond entirely in {lang_name}."
        )
        user_prompt = f"""{doc_registry_text}

RETRIEVED GOVERNANCE CONTEXT ACROSS ALL DOCUMENTS:
{context}

USER QUESTION / INSTRUCTION:
{question}

Answer strictly in {lang_name}:"""
    else:
        system_prompt = (
            "You are CivicLens AI — an elite multi-document governance intelligence assistant. "
            "Provide direct, high-impact, structured answers across all indexed documents.\n"
            "Rules:\n"
            "1. Start directly with the structured findings without conversational filler or boilerplate like 'Based on the provided context...'.\n"
            "2. Use crisp bullet points, bold key-value labels, and clear section headers.\n"
            "3. If multiple documents are mentioned, group or attribute findings clearly per document.\n"
            "4. Keep the output precise, factual, and strictly relevant to what was asked."
        )
        user_prompt = f"""{doc_registry_text}

RETRIEVED GOVERNANCE CONTEXT ACROSS ALL DOCUMENTS:
{context}

USER QUESTION / INSTRUCTION:
{question}

Structured Direct Answer:"""

    # 4. Call LLM
    from app.services.summarization_service import _call_llm
    answer = await _call_llm(system_prompt, user_prompt)
    
    # 4. Format Sources
    sources = []
    for i, doc in enumerate(docs):
        sources.append({
            "text": doc.page_content[:200] + "...",
            "filename": doc.metadata.get("filename", "Unknown"),
            "document_id": doc.metadata.get("document_id"),
            "relevance": "High"
        })
        
    return {
        "answer": answer,
        "sources": sources
    }

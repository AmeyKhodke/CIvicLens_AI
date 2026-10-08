"""LLM Summarization service with prompt chaining."""
import json
from typing import List
from app.config import settings


# Language code → full name for LLM instructions
LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi (हिन्दी)",
    "mr": "Marathi (मराठी)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
    "bn": "Bengali (বাংলা)",
    "gu": "Gujarati (ગુજરાતી)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
    "ur": "Urdu (اردو)"
}

SYSTEM_PROMPT = """You are an expert government meeting summarizer. You produce precise, 
neutral, formal summaries suitable for official government Minutes of Meeting (MoM) documents. 
Always maintain a formal, objective tone appropriate for government communication."""

EXTRACT_FACTS_PROMPT = """Analyze the following meeting transcript and extract:
1. All agenda items discussed
2. Key discussion points per agenda item
3. All decisions taken (with who made/approved them)
4. All action items with assigned person and deadline (if mentioned)
5. Any unresolved issues or flagged items
6. Overall tone/sentiment: collaborative, contentious, or neutral

Meeting Title: {title}
Meeting Date: {date}
Venue: {venue}
Attendees: {attendees}

TRANSCRIPT:
{transcript}

Respond ONLY in valid JSON with this structure:
{{
  "title": "...",
  "date": "...",
  "venue": "...",
  "attendees": ["name - designation"],
  "agenda_items": ["item 1", "item 2"],
  "key_points": ["point 1", "point 2"],
  "decisions": ["Decision 1 — Taken by: Name", "Decision 2 — Taken by: Name"],
  "action_items": [
    {{"action": "...", "assigned_to": "...", "deadline": "...", "status": "pending"}}
  ],
  "flagged_items": ["issue 1"],
  "sentiment": "collaborative|contentious|neutral",
  "confidentiality": "internal"
}}"""

EXECUTIVE_PROMPT = """Given the following structured meeting data, produce a concise 
EXECUTIVE SUMMARY (max 200 words) suitable for a busy government leader. 
Focus on decisions and action items only. Use formal government language.

Data: {data}

Respond with a plain text executive summary."""

VERBATIM_PROMPT = """Given the following meeting transcript, extract the most important
direct quotes (verbatim highlights) that capture key decisions, commitments, and 
significant statements. Include speaker attribution.

TRANSCRIPT:
{transcript}

Respond in JSON: {{"highlights": [{{"speaker": "...", "quote": "...", "context": "..."}}]}}"""


async def generate_summary(
    transcript: str,
    meeting_title: str,
    meeting_date: str,
    venue: str,
    attendees: list,
    summary_type: str = "detailed",
    language: str = "en",
) -> dict:
    """
    Generate structured meeting summary using LLM in the requested language.
    Uses prompt chaining: extract facts → structure → refine.
    """
    lang_name = LANGUAGE_NAMES.get(language, "English")
    lang_instruction = f"IMPORTANT: Write your ENTIRE response in {lang_name}. All summaries, key points, decisions, and action items MUST be written in {lang_name} only.\n\n" if language != "en" else ""
    
    # Language-aware system prompt
    system_prompt_localized = SYSTEM_PROMPT + (f" Always respond in {lang_name}." if language != "en" else "")
    
    attendees_str = ", ".join(
        f"{a.get('name', '')} ({a.get('designation', '')})"
        for a in attendees
    ) if attendees else "Not specified"

    # Step 1: Extract structured facts
    facts_prompt = lang_instruction + EXTRACT_FACTS_PROMPT.format(
        title=meeting_title,
        date=meeting_date,
        venue=venue,
        attendees=attendees_str,
        transcript=transcript[:8000],  # Limit transcript length
    )

    facts_response = await _call_llm(system_prompt_localized, facts_prompt)

    # Parse JSON from LLM response
    try:
        structured = _parse_json(facts_response)
    except Exception:
        structured = {
            "title": meeting_title,
            "date": meeting_date,
            "venue": venue,
            "key_points": [facts_response[:500]],
            "decisions": [],
            "action_items": [],
            "flagged_items": [],
            "sentiment": "neutral",
        }

    # Step 2: Generate type-specific output
    raw_text = ""
    if summary_type == "executive":
        exec_prompt = lang_instruction + EXECUTIVE_PROMPT.format(data=json.dumps(structured, indent=2))
        raw_text = await _call_llm(system_prompt_localized, exec_prompt)
    elif summary_type == "verbatim":
        verbatim_prompt = lang_instruction + VERBATIM_PROMPT.format(transcript=transcript[:8000])
        verbatim_response = await _call_llm(system_prompt_localized, verbatim_prompt)
        try:
            verbatim_data = _parse_json(verbatim_response)
            structured["verbatim_highlights"] = verbatim_data.get("highlights", [])
        except Exception:
            structured["verbatim_highlights"] = []
        raw_text = verbatim_response
    else:
        # Detailed: format the structured data as readable text
        raw_text = _format_detailed(structured, language=language)

    return {
        "structured": structured,
        "raw_text": raw_text,
        "language": language,
    }


import logging
logger = logging.getLogger(__name__)


async def _call_llm(system_prompt: str, user_prompt: str) -> str:
    """Call LLM with fallback chain: Ollama → Groq → OpenAI."""
    errors = []

    # Try Ollama first (local)
    try:
        return await _call_ollama(system_prompt, user_prompt)
    except Exception as e:
        logger.debug(f"Ollama call skipped/failed: {e}")
        errors.append(f"Ollama: {e}")

    # Fallback: Groq
    if settings.groq_api_key:
        try:
            return await _call_groq(system_prompt, user_prompt)
        except Exception as e:
            logger.warning(f"Groq LLM call failed: {e}")
            errors.append(f"Groq: {e}")

    # Fallback: OpenAI
    if settings.openai_api_key:
        try:
            return await _call_openai(system_prompt, user_prompt)
        except Exception as e:
            logger.warning(f"OpenAI LLM call failed: {e}")
            errors.append(f"OpenAI: {e}")

    err_summary = "; ".join(errors) if errors else "No API keys configured"
    raise RuntimeError(f"No LLM available. ({err_summary})")


async def _call_ollama(system_prompt: str, user_prompt: str) -> str:
    import httpx
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
            }
        )
        response.raise_for_status()
        return response.json()["message"]["content"]


async def _call_groq(system_prompt: str, user_prompt: str) -> str:
    import httpx
    import asyncio

    # Safe prompt length budget for Groq request
    trimmed_prompt = user_prompt if len(user_prompt) <= 9000 else (user_prompt[:5000] + "\n\n[...]\n\n" + user_prompt[-3500:])
    candidate_models = [settings.groq_model, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"]
    # Remove duplicates while preserving order
    models_to_try = [m for m in candidate_models if m]

    async def _post_request(client, prompt_text: str, max_tokens: int, model: str):
        return await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt_text},
                ],
                "temperature": 0.3,
                "max_tokens": max_tokens,
            }
        )

    last_error = None
    async with httpx.AsyncClient(timeout=120) as client:
        for model in models_to_try:
            try:
                response = await _post_request(client, trimmed_prompt, max_tokens=2048, model=model)
                
                # Handle 413 or 429 Rate Limit with backoff
                if response.status_code == 429:
                    logger.warning(f"Groq 429 rate limit on {model}. Waiting 2s before retry...")
                    await asyncio.sleep(2.0)
                    fallback_prompt = trimmed_prompt[:3500]
                    response = await _post_request(client, fallback_prompt, max_tokens=1000, model=model)

                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
                
                last_error = f"Groq HTTP {response.status_code} ({model}): {response.text[:100]}"
            except Exception as e:
                last_error = str(e)
                continue

    raise RuntimeError(last_error or "Groq calls failed on all candidate models")


async def _call_openai(system_prompt: str, user_prompt: str) -> str:
    import httpx
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": settings.openai_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 4000,
            }
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


def _parse_json(text: str) -> dict:
    """Extract JSON from LLM response (handles markdown code blocks)."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)


def _format_detailed(data: dict, language: str = "en") -> str:
    """Format structured data as readable detailed summary in the given language."""
    lines = []
    lines.append(f"Meeting Summary Report")
    lines.append("=" * 50)
    lines.append(f"📌 Title: {data.get('title', 'N/A')}")
    lines.append(f"📅 Date: {data.get('date', 'N/A')}")
    lines.append(f"📍 Venue: {data.get('venue', 'N/A')}")
    lines.append("")

    if data.get("agenda_items"):
        lines.append("🗂 Agenda Items:")
        for i, item in enumerate(data["agenda_items"], 1):
            lines.append(f"  {i}. {item}")
        lines.append("")

    if data.get("key_points"):
        lines.append("📝 Key Discussion Points:")
        for point in data["key_points"]:
            lines.append(f"  • {point}")
        lines.append("")

    if data.get("decisions"):
        lines.append("✅ Decisions Taken:")
        for dec in data["decisions"]:
            lines.append(f"  • {dec}")
        lines.append("")

    if data.get("action_items"):
        lines.append("📌 Action Items:")
        for a in data["action_items"]:
            lines.append(f"  • {a.get('action', '')} → {a.get('assigned_to', 'TBD')} (Deadline: {a.get('deadline', 'TBD')})")
        lines.append("")

    if data.get("flagged_items"):
        lines.append("⚠️ Flagged Items:")
        for item in data["flagged_items"]:
            lines.append(f"  • {item}")
        lines.append("")

    lines.append(f"📊 Sentiment: {data.get('sentiment', 'neutral').title()}")
    lines.append(f"🔐 Confidentiality: {data.get('confidentiality', 'internal').title()}")

    return "\n".join(lines)

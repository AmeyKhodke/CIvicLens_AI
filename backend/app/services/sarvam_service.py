"""Sarvam AI integration for high-accuracy Indic language translation and processing."""
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# Sarvam language code mapping
SARVAM_LANG_MAP = {
    "hi": "hi-IN",
    "mr": "mr-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "kn": "kn-IN",
    "gu": "gu-IN",
    "bn": "bn-IN",
    "pa": "pa-IN",
    "ml": "ml-IN",
    "od": "od-IN",
    "en": "en-IN"
}


async def translate_with_sarvam(text: str, target_lang: str = "mr", source_lang: str = "en") -> str:
    """Translate text using Sarvam AI translation API."""
    if not settings.sarvam_api_key or not text.strip():
        return text

    target_code = SARVAM_LANG_MAP.get(target_lang, f"{target_lang}-IN")
    source_code = SARVAM_LANG_MAP.get(source_lang, f"{source_lang}-IN")

    if target_code == source_code:
        return text

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.sarvam.ai/translate",
                headers={
                    "api-subscription-key": settings.sarvam_api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "input": text[:2000],  # Sarvam chunk limit
                    "source_language_code": source_code,
                    "target_language_code": target_code,
                    "mode": "formal"
                }
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("translated_text", text)
    except Exception as e:
        logger.warning(f"Sarvam translation failed: {e}")
        return text

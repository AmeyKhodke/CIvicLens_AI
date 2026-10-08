"""Application configuration via environment variables."""
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # ── App ──
    app_name: str = "AI Meeting Co-Pilot"
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # ── Database ──
    database_url: str = "sqlite:///./meetings.db"

    # ── Redis ──
    redis_url: str = "redis://localhost:6379/0"

    # ── Whisper ──
    whisper_model: str = "base"
    whisper_device: str = "cpu"

    # ── LLM ──
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"

    # ── Bhashini & Sarvam (Indic Languages) ──
    bhashini_api_key: str = ""
    bhashini_user_id: str = ""
    sarvam_api_key: str = ""

    # ── ChromaDB ──
    chroma_persist_dir: str = "./chroma_data"

    # ── Security ──
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 480
    encryption_key: str = "change-me-32-byte-key-for-aes256"

    # ── File Storage ──
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 2048

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

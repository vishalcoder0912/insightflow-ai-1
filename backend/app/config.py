"""Application configuration loaded from environment variables."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Environment-based settings for the InsightFlow AI backend."""

    # Server
    port: int = 8000
    cors_origin: str = "*"

    # PostgreSQL (app metadata — future use)
    database_url: str = ""
    pg_host: str = "127.0.0.1"
    pg_port: int = 5432
    pg_user: str = "postgres"
    pg_password: str = "postgres"
    pg_database: str = "insightflow_ai"

    # AI Models
    text_to_sql_model: str = "cssupport/t5-small-awesome-text-to-sql"
    model_cache_dir: str = str(Path(__file__).resolve().parent.parent / ".model_cache")
    preload_text_to_sql_model: bool = False

    # Ollama (optional local LLM)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_enabled: bool = False

    # Data storage
    data_dir: str = str(Path(__file__).resolve().parent.parent / "data")
    max_upload_size_mb: int = 50

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "protected_namespaces": ("settings_",),
    }


settings = Settings()

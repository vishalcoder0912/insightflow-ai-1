"""Model Loader — Lazy-loads Hugging Face models and caches them in memory."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

_tokenizer = None
_model = None
_model_loaded = False


def _ensure_cache_dir() -> Path:
    """Ensure the model cache directory exists."""
    cache_dir = Path(settings.model_cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def load_text_to_sql_model():
    """
    Lazy-load the Text-to-SQL model and tokenizer.
    
    Downloads from Hugging Face on first run, then caches locally.
    Uses T5-small fine-tuned on Text-to-SQL by default.
    """
    global _tokenizer, _model, _model_loaded

    if _model_loaded:
        return _tokenizer, _model

    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        cache_dir = _ensure_cache_dir()
        model_name = settings.text_to_sql_model

        logger.info(f"Loading Text-to-SQL model: {model_name}")
        logger.info(f"Cache directory: {cache_dir}")

        _tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=str(cache_dir),
        )

        _model = AutoModelForSeq2SeqLM.from_pretrained(
            model_name,
            cache_dir=str(cache_dir),
        )

        _model.eval()  # Set to evaluation mode
        _model_loaded = True

        logger.info(f"Model loaded successfully: {model_name}")
        return _tokenizer, _model

    except Exception as e:
        logger.error(f"Failed to load Text-to-SQL model: {e}")
        logger.info("Text-to-SQL will use rule-based fallback.")
        _model_loaded = False
        return None, None


def is_model_available() -> bool:
    """Check if the ML model is loaded and ready."""
    return _model_loaded and _model is not None and _tokenizer is not None


def get_model_info() -> dict:
    """Get info about the currently loaded model."""
    return {
        "model_name": settings.text_to_sql_model,
        "loaded": _model_loaded,
        "cache_dir": settings.model_cache_dir,
    }

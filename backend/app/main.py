"""InsightFlow AI — Python Backend Entry Point.

A FastAPI application providing AI-powered data analytics:
- CSV/Excel upload with auto-profiling
- Text-to-SQL natural language querying
- Statistical analysis (correlations, outliers, distributions, trends)
- Smart chart recommendations
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    logger.info("Starting InsightFlow AI backend...")
    logger.info(f"Port: {settings.port}")
    logger.info(f"Text-to-SQL model: {settings.text_to_sql_model}")
    logger.info(f"Ollama enabled: {settings.ollama_enabled}")

    # Optional pre-load in a daemon thread so startup never blocks route availability.
    if settings.preload_text_to_sql_model:
        def _preload_model() -> None:
            try:
                from app.ai.model_loader import load_text_to_sql_model
                logger.info("Background preloading Text-to-SQL model...")
                load_text_to_sql_model()
            except Exception as exc:
                logger.warning("Could not pre-load model: %s. Using rule-based fallback.", exc)

        threading.Thread(target=_preload_model, daemon=True).start()
    else:
        logger.info("Skipping model preload on startup (preload_text_to_sql_model=false).")

    logger.info("Backend ready!")
    yield

    # Shutdown
    from app.services.sql_executor import sql_executor
    sql_executor.close()
    logger.info("Backend shut down.")


# Create the FastAPI app
app = FastAPI(
    title="InsightFlow AI",
    description="AI-powered data analytics platform with Text-to-SQL and statistical analysis.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin.split(",") if settings.cors_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Mount Routers ────────────────────────────────────────────────────────────

from app.routers import datasets, chat, analysis, export, system  # noqa: E402

app.include_router(datasets.router)
app.include_router(chat.router)
app.include_router(analysis.router)
app.include_router(export.router)
app.include_router(system.router)


@app.post("/api/upload")
async def legacy_upload_alias(
    file: UploadFile | None = File(None),
    csv: str | None = Form(None),
    fileName: str | None = Form(None),
):
    """Compatibility alias for the pre-router upload endpoint."""
    return await datasets.upload_dataset(file=file, csv=csv, fileName=fileName)


@app.get("/api/dataset/info")
async def legacy_dataset_info_alias():
    """Compatibility alias for the pre-router dataset info endpoint."""
    return await datasets.get_current_dataset()


# ── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from app.ai.model_loader import is_model_available, get_model_info

    return {
        "status": "ok",
        "version": "2.0.0",
        "ai_model": get_model_info(),
        "ollama_enabled": settings.ollama_enabled,
    }


# ── Run with uvicorn ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
    )

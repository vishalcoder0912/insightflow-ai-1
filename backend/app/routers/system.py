"""System router for backend status and diagnostics."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.routers.datasets import _get_current_dataset
from app.services.metadata_store import metadata_store
from app.services.sql_executor import sql_executor

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status")
async def get_system_status():
    """Return backend, dataset, and metadata DB status."""
    dataset = _get_current_dataset()
    return {
        "status": "ok",
        "dataset_loaded": dataset is not None,
        "dataset_file": dataset.get("file_name") if dataset else None,
        "sql_executor": sql_executor.health(),
        "metadata_db": metadata_store.status(),
    }


@router.get("/chats")
async def get_recent_chats(limit: int = Query(20, ge=1, le=200)):
    """Return recent persisted chat interactions."""
    return {
        "items": metadata_store.get_recent_chats(limit=limit),
        "count": limit,
    }

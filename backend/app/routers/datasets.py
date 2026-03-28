import io
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.config import settings
from app.services.data_profiler import profile_dataframe
from app.services.metadata_store import metadata_store
from app.services.sql_executor import sql_executor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

# Path for persistent storage
DATA_DIR = Path(settings.data_dir)
PERSISTENT_FILE = DATA_DIR / "current_dataset.csv"
PERSISTENT_META = DATA_DIR / "current_metadata.json"

# In-memory dataset store (single active dataset)
_current_dataset: dict | None = None
_current_df: pd.DataFrame | None = None


def _get_current_df() -> pd.DataFrame | None:
    """Get the current DataFrame (used by other modules)."""
    _ensure_runtime_loaded()
    return _current_df


def _get_current_dataset() -> dict | None:
    """Get the current dataset record (used by other modules)."""
    _ensure_runtime_loaded()
    return _current_dataset


def _save_persistence(df: pd.DataFrame, dataset_record: dict):
    """Save the dataframe and metadata to disk."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        
        df.to_csv(PERSISTENT_FILE, index=False)
        
        import json
        with open(PERSISTENT_META, "w", encoding="utf-8") as f:
            json.dump(dataset_record, f)
        metadata_store.save_dataset("current", dataset_record)
    except Exception as e:
        logger.warning(f"Could not save persistence: {e}")


def load_persistence():
    """Reload the last active dataset from disk on startup."""
    global _current_dataset, _current_df
    try:
        if PERSISTENT_FILE.exists() and PERSISTENT_META.exists():
            import json
            with open(PERSISTENT_META, "r", encoding="utf-8") as f:
                _current_dataset = json.load(f)
            
            _current_df = pd.read_csv(PERSISTENT_FILE)
            sql_executor.load_dataframe(_current_df)
            logger.info(f"Reloaded persistent dataset: {_current_dataset.get('file_name')}")
            metadata_store.save_dataset("current", _current_dataset)
            return

        # Fallback: recover metadata from SQLite if JSON file is missing.
        db_dataset = metadata_store.get_dataset("current")
        if db_dataset and PERSISTENT_FILE.exists():
            _current_dataset = db_dataset
            _current_df = pd.read_csv(PERSISTENT_FILE)
            sql_executor.load_dataframe(_current_df)
            logger.info(f"Reloaded dataset from metadata DB: {_current_dataset.get('file_name')}")
    except Exception as e:
        logger.warning(f"Failed to reload persistence: {e}")


def _ensure_runtime_loaded():
    """Lazy-load runtime dataset state from persistence or metadata DB."""
    global _current_dataset, _current_df
    if _current_dataset is not None and _current_df is not None:
        return
    load_persistence()


# Initialize persistence logic
load_persistence()


@router.post("")
async def upload_dataset(
    file: UploadFile | None = File(None),
    csv: str | None = Form(None),
    fileName: str | None = Form(None),
):
    """
    Upload a CSV dataset. Accepts either:
    - A file upload (multipart/form-data)
    - Raw CSV string in form field 'csv' with 'fileName'
    """
    global _current_dataset, _current_df

    try:
        if file:
            # File upload
            content = await file.read()
            file_name = file.filename or "uploaded.csv"

            if file_name.endswith(".xlsx") or file_name.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(content))
            else:
                csv_text = content.decode("utf-8")
                df = pd.read_csv(io.StringIO(csv_text))

        elif csv:
            # Raw CSV string (backward compatible with old frontend)
            file_name = fileName or "uploaded.csv"
            df = pd.read_csv(io.StringIO(csv))

        else:
            raise HTTPException(status_code=400, detail="No file or CSV data provided.")

        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file contains no data.")

        # Profile the dataset
        summary = profile_dataframe(df, file_name)

        # Build preview rows
        preview_rows = [
            [str(val) for val in row]
            for row in df.head(100).values.tolist()
        ]

        # Store in memory
        _current_df = df
        _current_dataset = {
            "id": "current",
            "file_name": file_name,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "headers": list(df.columns),
            "total_rows": len(df),
            "preview_rows": preview_rows,
            "summary": summary.model_dump(),
        }

        # Load into SQLite for SQL queries
        sql_executor.load_dataframe(df)

        # Save to disk for persistence
        _save_persistence(df, _current_dataset)

        logger.info(f"Dataset uploaded: {file_name} ({len(df)} rows, {len(df.columns)} cols)")

        return _current_dataset

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")


@router.post("/legacy-upload")
async def legacy_upload_dataset(
    file: UploadFile | None = File(None),
    csv: str | None = Form(None),
    fileName: str | None = Form(None),
):
    """Compatibility alias for older clients that used alternate upload routes."""
    return await upload_dataset(file=file, csv=csv, fileName=fileName)


@router.get("/current")
async def get_current_dataset():
    """Get the currently active dataset summary and preview."""
    _ensure_runtime_loaded()
    if _current_dataset is None:
        return None
    return _current_dataset


@router.get("/legacy-info")
async def get_legacy_dataset_info():
    """Compatibility alias for older clients that fetched dataset info separately."""
    return await get_current_dataset()


@router.delete("/current")
async def delete_current_dataset():
    """Clear the current dataset."""
    global _current_dataset, _current_df

    _current_dataset = None
    _current_df = None
    sql_executor.close()
    metadata_store.clear_dataset("current")

    # Clear persistence
    if PERSISTENT_FILE.exists():
        PERSISTENT_FILE.unlink(missing_ok=True)
    if PERSISTENT_META.exists():
        PERSISTENT_META.unlink(missing_ok=True)

    return {"success": True}

"""Export Router — Generate structured reports and downloads without paid APIs."""

from __future__ import annotations

import io
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.routers.datasets import _get_current_df, _get_current_dataset
from app.services.stats_engine import compute_correlations, detect_all_outliers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/csv")
async def export_dataset_csv():
    """Download the current dataset as a CSV file."""
    df = _get_current_df()
    meta = _get_current_dataset()

    if df is None or meta is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    # Convert DataFrame to CSV string in memory
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    # Reset stream pointer
    stream.seek(0)
    
    filename = meta.get("file_name", "dataset").replace(".csv", "")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    download_name = f"{filename}_export_{timestamp}.csv"

    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={download_name}"}
    )


@router.get("/report/json")
async def export_analysis_report_json():
    """Generates a full statistical analysis report as a JSON file."""
    df = _get_current_df()
    meta = _get_current_dataset()

    if df is None or meta is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    filename = meta.get("file_name", "dataset").replace(".csv", "")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    # Run core statistical routines dynamically
    try:
        correlations = compute_correlations(df)
        outliers = detect_all_outliers(df, method="iqr")
        
        report = {
            "metadata": {
                "dataset_name": filename,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "total_rows": len(df),
                "total_columns": len(df.columns),
            },
            "summary": meta.get("summary", {}),
            "analysis": {
                "correlations": correlations.model_dump() if correlations else None,
                "outliers": [out.model_dump() for out in outliers] if outliers else [],
            }
        }
        
        json_str = json.dumps(report, indent=2)

        return StreamingResponse(
            iter([json_str]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}_report_{timestamp}.json"}
        )

    except Exception as e:
        logger.error(f"Failed to generate JSON report: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

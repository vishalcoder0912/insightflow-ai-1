"""Analysis router — Statistical analysis endpoints."""

from __future__ import annotations

import logging

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import AnalysisResponse, ComprehensiveReport
from app.routers.datasets import _get_current_df, _get_current_dataset
from app.services.stats_engine import (
    analyze_distribution,
    analyze_trend,
    compute_correlations,
    detect_all_outliers,
    detect_outliers,
)
from app.services.analysis_report import generate_comprehensive_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        numeric = float(value)
        if np.isnan(numeric):
            return default
        return numeric
    except (TypeError, ValueError):
        return default


@router.get("/correlations")
async def get_correlations():
    """Compute correlation matrix for all numeric columns."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    result = compute_correlations(df)

    summary_parts = []
    if result.strong_correlations:
        for corr in result.strong_correlations[:3]:
            summary_parts.append(
                f"{corr['column_a']} and {corr['column_b']}: "
                f"{corr['correlation']:.2f} ({corr['direction']})"
            )
        summary = "Strong correlations found: " + "; ".join(summary_parts) + "."
    else:
        summary = "No strong correlations (|r| > 0.7) found among numeric columns."

    return AnalysisResponse(
        analysis_type="correlations",
        results=result.model_dump(),
        summary=summary,
    )


@router.get("/outliers")
async def get_outliers(
    column: str | None = Query(None, description="Specific column to analyze"),
    method: str = Query("iqr", description="Detection method: 'iqr' or 'zscore'"),
):
    """Detect outliers in numeric columns."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    if method not in ("iqr", "zscore"):
        raise HTTPException(status_code=400, detail="Method must be 'iqr' or 'zscore'.")

    if column:
        if column not in df.columns:
            raise HTTPException(status_code=404, detail=f"Column '{column}' not found.")
        results = [detect_outliers(df, column, method)]
    else:
        results = detect_all_outliers(df, method)

    total_outliers = sum(r.outlier_count for r in results)
    summary = f"Found {total_outliers} outlier(s) across {len(results)} numeric column(s) using {method.upper()} method."

    normalized_results = [
        {
            "column": r.column,
            "method": r.method,
            "outlier_count": r.outlier_count,
            "outlier_percentage": r.outlier_percentage,
            "lower_bound": _safe_float(r.bounds.get("lower")),
            "upper_bound": _safe_float(r.bounds.get("upper")),
            "bounds": r.bounds,
        }
        for r in results
    ]

    return AnalysisResponse(
        analysis_type="outliers",
        results=normalized_results,
        summary=summary,
    )


@router.get("/distributions")
async def get_distributions(
    column: str | None = Query(None, description="Specific column to analyze"),
):
    """Analyze distributions of numeric columns."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    if column:
        if column not in df.columns:
            raise HTTPException(status_code=404, detail=f"Column '{column}' not found.")
        results = [analyze_distribution(df, column)]
    else:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        results = [analyze_distribution(df, col) for col in numeric_cols[:10]]

    summaries = []
    for r in results:
        if r.skewness is not None:
            skew_desc = "right-skewed" if r.skewness > 0.5 else "left-skewed" if r.skewness < -0.5 else "symmetric"
            summaries.append(f"{r.column}: {skew_desc} (skewness={r.skewness:.2f})")

    summary = "Distribution analysis: " + "; ".join(summaries) if summaries else "Distribution analysis complete."

    normalized_results = []
    for r in results:
        std_value = _safe_float(r.stats.get("std"))
        normalized_results.append(
            {
                "column": r.column,
                "mean": _safe_float(r.stats.get("mean")),
                "median": _safe_float(r.stats.get("50%")),
                "variance": round(std_value * std_value, 4),
                "skewness": _safe_float(r.skewness),
                "stats": r.stats,
                "normality_test": r.normality_test,
            }
        )

    return AnalysisResponse(
        analysis_type="distributions",
        results=normalized_results,
        summary=summary,
    )


@router.get("/trends")
async def get_trends(
    value_column: str = Query(..., description="Numeric column to analyze trends for"),
    temporal_column: str = Query(..., description="Time/date column for the x-axis"),
):
    """Analyze trends of a numeric column over time."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    if value_column not in df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{value_column}' not found.")
    if temporal_column not in df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{temporal_column}' not found.")

    result = analyze_trend(df, value_column, temporal_column)

    summary = (
        f"Trend for {value_column} over {temporal_column}: "
        f"**{result.trend_direction}** (slope={result.slope:.4f})."
    )

    return AnalysisResponse(
        analysis_type="trends",
        results=result.model_dump(),
        summary=summary,
    )


@router.get("/report", response_model=ComprehensiveReport)
async def get_comprehensive_report():
    """
    Generate a comprehensive professional data analysis report.
    
    Includes:
    - Data Overview with schema explanation
    - 5-10 KPIs with formulas and interpretations
    - Insights & Trends with business implications
    - 6 Dashboard-ready charts with explanations
    - Advanced Analysis (segmentation, correlations, anomalies)
    - Python code for dashboard generation
    """
    df = _get_current_df()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")
    
    dataset = _get_current_dataset()
    file_name = dataset.get("file_name", "dataset.csv") if dataset else "dataset.csv"
    
    logger.info(f"Generating comprehensive report for {file_name}")
    report = generate_comprehensive_report(df, file_name)
    
    return report

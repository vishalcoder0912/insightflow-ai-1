"""Statistical Analysis Engine — Correlations, outliers, distributions, trends."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

from app.models.schemas import (
    CorrelationResult,
    DistributionResult,
    OutlierResult,
    TrendResult,
)


# ── Correlation Analysis ─────────────────────────────────────────────────────

def compute_correlations(df: pd.DataFrame) -> CorrelationResult:
    """Compute correlation matrix for numeric columns."""
    numeric_df = df.select_dtypes(include=[np.number])

    if numeric_df.shape[1] < 2:
        return CorrelationResult(columns=[], matrix=[], strong_correlations=[])

    corr_matrix = numeric_df.corr()
    columns = list(corr_matrix.columns)
    matrix = corr_matrix.fillna(0).values.tolist()

    # Find strong correlations (|r| > 0.7, excluding self-correlations)
    strong: list[dict[str, Any]] = []
    for i in range(len(columns)):
        for j in range(i + 1, len(columns)):
            r = corr_matrix.iloc[i, j]
            if not np.isnan(r) and abs(r) > 0.7:
                strong.append({
                    "column_a": columns[i],
                    "column_b": columns[j],
                    "correlation": round(float(r), 4),
                    "strength": "strong" if abs(r) > 0.85 else "moderate",
                    "direction": "positive" if r > 0 else "negative",
                })

    strong.sort(key=lambda x: abs(x["correlation"]), reverse=True)

    return CorrelationResult(
        columns=columns,
        matrix=[[round(float(v), 4) for v in row] for row in matrix],
        strong_correlations=strong,
    )


# ── Outlier Detection ────────────────────────────────────────────────────────

def detect_outliers(
    df: pd.DataFrame, column: str, method: str = "iqr"
) -> OutlierResult:
    """Detect outliers in a numeric column using IQR or Z-score method."""
    series = pd.to_numeric(df[column], errors="coerce").dropna()

    if len(series) < 4:
        return OutlierResult(
            column=column, method=method, outlier_count=0,
            outlier_percentage=0.0, bounds={},
        )

    if method == "zscore":
        z_scores = np.abs(scipy_stats.zscore(series))
        outlier_mask = z_scores > 3
        bounds = {
            "lower": round(float(series.mean() - 3 * series.std()), 4),
            "upper": round(float(series.mean() + 3 * series.std()), 4),
        }
    else:  # IQR
        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        outlier_mask = (series < lower_bound) | (series > upper_bound)
        bounds = {
            "q1": round(q1, 4),
            "q3": round(q3, 4),
            "iqr": round(iqr, 4),
            "lower": round(lower_bound, 4),
            "upper": round(upper_bound, 4),
        }

    outlier_indices = list(series[outlier_mask].index.astype(int))
    outlier_count = int(outlier_mask.sum())
    outlier_pct = round((outlier_count / len(series)) * 100, 2) if len(series) > 0 else 0.0

    return OutlierResult(
        column=column,
        method=method,
        outlier_count=outlier_count,
        outlier_percentage=outlier_pct,
        outlier_indices=outlier_indices[:100],  # Cap for response size
        bounds=bounds,
    )


def detect_all_outliers(df: pd.DataFrame, method: str = "iqr") -> list[OutlierResult]:
    """Detect outliers across all numeric columns."""
    results = []
    for col in df.select_dtypes(include=[np.number]).columns:
        results.append(detect_outliers(df, col, method))
    return results


# ── Distribution Analysis ────────────────────────────────────────────────────

def analyze_distribution(df: pd.DataFrame, column: str) -> DistributionResult:
    """Analyze the distribution of a numeric column."""
    series = pd.to_numeric(df[column], errors="coerce").dropna()

    if len(series) < 4:
        return DistributionResult(column=column, stats={})

    # Histogram bins
    counts, bin_edges = np.histogram(series, bins=min(20, max(5, len(series) // 10)))
    histogram = [
        {
            "bin_start": round(float(bin_edges[i]), 4),
            "bin_end": round(float(bin_edges[i + 1]), 4),
            "count": int(counts[i]),
        }
        for i in range(len(counts))
    ]

    # Descriptive stats
    desc = series.describe()
    stats_dict = {
        "count": int(desc["count"]),
        "mean": round(float(desc["mean"]), 4),
        "std": round(float(desc["std"]), 4),
        "min": round(float(desc["min"]), 4),
        "25%": round(float(desc["25%"]), 4),
        "50%": round(float(desc["50%"]), 4),
        "75%": round(float(desc["75%"]), 4),
        "max": round(float(desc["max"]), 4),
    }

    # Skewness and kurtosis
    skewness = round(float(series.skew()), 4) if len(series) >= 8 else None
    kurtosis = round(float(series.kurtosis()), 4) if len(series) >= 8 else None

    # Normality test (Shapiro-Wilk for small samples, D'Agostino for large)
    normality_test = None
    try:
        if 8 <= len(series) <= 5000:
            stat, p_value = scipy_stats.shapiro(series.head(5000))
            normality_test = {
                "test": "Shapiro-Wilk",
                "statistic": round(float(stat), 6),
                "p_value": round(float(p_value), 6),
                "is_normal": p_value > 0.05,
            }
        elif len(series) > 5000:
            stat, p_value = scipy_stats.normaltest(series)
            normality_test = {
                "test": "D'Agostino-Pearson",
                "statistic": round(float(stat), 6),
                "p_value": round(float(p_value), 6),
                "is_normal": p_value > 0.05,
            }
    except Exception:
        pass

    return DistributionResult(
        column=column,
        histogram=histogram,
        stats=stats_dict,
        skewness=skewness,
        kurtosis=kurtosis,
        normality_test=normality_test,
    )


# ── Trend Analysis ───────────────────────────────────────────────────────────

def analyze_trend(
    df: pd.DataFrame, value_column: str, temporal_column: str
) -> TrendResult:
    """Analyze trends of a numeric column over a temporal column."""
    temp_df = df[[temporal_column, value_column]].dropna().copy()

    # Try to parse as datetime
    try:
        temp_df[temporal_column] = pd.to_datetime(temp_df[temporal_column], errors="coerce")
        temp_df = temp_df.dropna()
        temp_df = temp_df.sort_values(temporal_column)
        grouped = temp_df.groupby(temp_df[temporal_column].dt.to_period("M"))[value_column]
        agg = grouped.mean()
        labels = [str(p) for p in agg.index]
    except Exception:
        # Try as numeric (e.g., year column)
        try:
            temp_df[temporal_column] = pd.to_numeric(temp_df[temporal_column], errors="coerce")
            temp_df = temp_df.dropna()
            temp_df = temp_df.sort_values(temporal_column)
            grouped = temp_df.groupby(temporal_column)[value_column]
            agg = grouped.mean()
            labels = [str(int(v)) if float(v).is_integer() else str(v) for v in agg.index]
        except Exception:
            return TrendResult(
                column=value_column, temporal_column=temporal_column,
                trend_direction="unknown", slope=0.0,
            )

    if len(agg) < 3:
        return TrendResult(
            column=value_column, temporal_column=temporal_column,
            trend_direction="insufficient_data", slope=0.0,
        )

    values = agg.values.astype(float)

    # Linear regression for trend direction
    x = np.arange(len(values), dtype=float)
    slope_val, _, r_value, _, _ = scipy_stats.linregress(x, values)

    r_squared = r_value ** 2
    if abs(slope_val) < 0.01 * np.std(values):
        direction = "stable"
    elif r_squared < 0.3:
        direction = "fluctuating"
    elif slope_val > 0:
        direction = "increasing"
    else:
        direction = "decreasing"

    data_points = [
        {"label": label, "value": round(float(val), 2)}
        for label, val in zip(labels, values)
    ]

    return TrendResult(
        column=value_column,
        temporal_column=temporal_column,
        trend_direction=direction,
        slope=round(float(slope_val), 6),
        data_points=data_points,
    )

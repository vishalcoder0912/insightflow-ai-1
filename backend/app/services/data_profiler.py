"""Data profiler — Pandas-based auto-profiling of uploaded datasets."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import (
    ChartSuggestion,
    ColumnProfile,
    DatasetSummary,
    KPI,
)


# ── Column Type Detection ────────────────────────────────────────────────────

_DATE_PATTERNS = [
    r"\d{4}-\d{2}-\d{2}",
    r"\d{2}/\d{2}/\d{4}",
    r"\d{2}-\d{2}-\d{4}",
]


def _coerce_numeric_series(series: pd.Series) -> pd.Series:
    """Coerce mixed-format numeric text (currency/commas/percent/accounting) to float."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    cleaned = (
        series.astype(str)
        .str.strip()
        .replace({"": np.nan, "nan": np.nan, "None": np.nan, "null": np.nan})
        # Accounting negatives: "(123.4)" -> "-123.4"
        .str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        # Keep only sign, decimal point, and digits.
        .str.replace(r"[^0-9.\-+]", "", regex=True)
    )
    return pd.to_numeric(cleaned, errors="coerce")


def _detect_column_type(series: pd.Series) -> str:
    """Detect semantic type of a column beyond pandas dtype."""
    if pd.api.types.is_bool_dtype(series):
        return "boolean"

    if pd.api.types.is_numeric_dtype(series):
        return "numeric"

    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"

    # Check string columns for dates
    sample = series.dropna().head(20).astype(str)
    if len(sample) > 0:
        date_matches = sum(
            1
            for val in sample
            if any(re.match(pat, str(val).strip()) for pat in _DATE_PATTERNS)
        )
        if date_matches / len(sample) > 0.7:
            return "datetime"

    # Check if it looks like a numeric column stored as formatted string.
    numeric_probe = _coerce_numeric_series(series.dropna().head(200))
    if len(numeric_probe) and numeric_probe.notna().mean() >= 0.7:
        return "numeric"

    nunique = series.nunique()
    total = len(series.dropna())
    if total > 0 and nunique / total < 0.05 and nunique <= 2:
        return "boolean"
    if total > 0 and nunique / total < 0.8 and nunique <= 50:
        return "categorical"

    return "text"


# ── Column Profiling ─────────────────────────────────────────────────────────

def _profile_column(df: pd.DataFrame, col: str) -> ColumnProfile:
    """Build a detailed profile for a single column."""
    series = df[col]
    filled = int(series.notna().sum())
    missing = int(series.isna().sum())
    unique = int(series.nunique())
    detected_type = _detect_column_type(series)

    profile = ColumnProfile(
        name=col,
        dtype=str(series.dtype),
        detected_type=detected_type,
        filled=filled,
        missing=missing,
        unique=unique,
        sample_values=[str(v) for v in series.dropna().head(5).tolist()],
        numeric=detected_type == "numeric",
    )

    if detected_type == "numeric":
        numeric_series = _coerce_numeric_series(series).dropna()
        if len(numeric_series) > 0:
            profile.min = round(float(numeric_series.min()), 2)
            profile.max = round(float(numeric_series.max()), 2)
            profile.average = round(float(numeric_series.mean()), 2)
            profile.median = round(float(numeric_series.median()), 2)
            profile.std = round(float(numeric_series.std()), 2)
            profile.sum = round(float(numeric_series.sum()), 2)

    if detected_type == "categorical":
        value_counts = series.value_counts().head(10)
        profile.top_values = [
            {"value": str(idx), "count": int(cnt)}
            for idx, cnt in value_counts.items()
        ]

    return profile


# ── Domain Detection ─────────────────────────────────────────────────────────

_DOMAIN_KEYWORDS = {
    "finance": ["revenue", "profit", "sales", "price", "cost", "income", "expense", "budget", "tax"],
    "healthcare": ["patient", "diagnosis", "treatment", "hospital", "medical", "health", "symptom"],
    "education": ["student", "grade", "course", "school", "university", "teacher", "exam"],
    "ecommerce": ["product", "order", "customer", "cart", "shipping", "payment", "review"],
    "hr": ["employee", "salary", "department", "hire", "position", "manager", "attendance"],
    "marketing": ["campaign", "click", "impression", "conversion", "channel", "ad", "roi"],
    "sports": ["player", "team", "score", "match", "season", "league", "goal"],
}


def _detect_domain(columns: list[str]) -> str:
    """Detect the probable domain of the dataset from column names."""
    col_text = " ".join(c.lower().replace("_", " ") for c in columns)
    scores = {}
    for domain, keywords in _DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for kw in keywords if kw in col_text)
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "general"


# ── KPI Generation ───────────────────────────────────────────────────────────

def _generate_kpis(df: pd.DataFrame, columns: list[ColumnProfile]) -> list[KPI]:
    """Generate smart KPIs from the dataset."""
    kpis: list[KPI] = []

    # Total rows
    kpis.append(KPI(
        label="Total Records",
        value=f"{len(df):,}",
        description=f"The dataset contains {len(df):,} rows.",
        icon="database",
    ))

    # Numeric column KPIs
    numeric_cols = [c for c in columns if c.numeric]
    for col in numeric_cols[:3]:  # Top 3 numeric columns
        if col.sum is not None and col.sum > 0:
            kpis.append(KPI(
                label=f"Total {col.name}",
                value=f"{col.sum:,.2f}",
                description=f"Sum of all {col.name} values.",
                icon="trending-up",
            ))
        if col.average is not None:
            kpis.append(KPI(
                label=f"Avg {col.name}",
                value=f"{col.average:,.2f}",
                description=f"Average {col.name} across all records.",
                icon="bar-chart",
            ))

    # Missing data KPI
    total_missing = sum(c.missing for c in columns)
    total_cells = len(df) * len(columns)
    if total_cells > 0:
        missing_pct = (total_missing / total_cells) * 100
        kpis.append(KPI(
            label="Data Completeness",
            value=f"{100 - missing_pct:.1f}%",
            description=f"{total_missing:,} missing values out of {total_cells:,} cells.",
            icon="check-circle" if missing_pct < 5 else "alert-triangle",
        ))

    # Unique categories KPI
    cat_cols = [c for c in columns if c.detected_type == "categorical"]
    if cat_cols:
        primary_cat = cat_cols[0]
        kpis.append(KPI(
            label=f"Unique {primary_cat.name}",
            value=str(primary_cat.unique),
            description=f"{primary_cat.unique} distinct values in {primary_cat.name}.",
            icon="layers",
        ))

    return kpis[:8]  # Cap at 8 KPIs


# ── Insight Generation ───────────────────────────────────────────────────────

def _generate_insights(df: pd.DataFrame, columns: list[ColumnProfile], domain: str) -> list[str]:
    """Generate human-readable insights from the dataset."""
    insights: list[str] = []

    # Dataset overview
    insights.append(
        f"This {domain} dataset contains {len(df):,} records across "
        f"{len(columns)} columns ({sum(1 for c in columns if c.numeric)} numeric, "
        f"{sum(1 for c in columns if c.detected_type == 'categorical')} categorical)."
    )

    # Numeric insights
    for col in columns:
        if col.numeric and col.min is not None and col.max is not None:
            spread = col.max - col.min
            if col.std and col.average and col.average != 0:
                cv = (col.std / abs(col.average)) * 100
                if cv > 50:
                    insights.append(
                        f"**{col.name}** shows high variability (CV={cv:.0f}%) — "
                        f"ranging from {col.min:,.2f} to {col.max:,.2f}."
                    )
                else:
                    insights.append(
                        f"**{col.name}** ranges from {col.min:,.2f} to {col.max:,.2f} "
                        f"with average {col.average:,.2f}."
                    )

    # Missing data insights
    cols_with_missing = [c for c in columns if c.missing > 0]
    if cols_with_missing:
        worst = max(cols_with_missing, key=lambda c: c.missing)
        pct = (worst.missing / (worst.filled + worst.missing)) * 100
        insights.append(
            f"**{worst.name}** has the most missing data ({worst.missing:,} values, {pct:.1f}%)."
        )

    # Categorical insights
    for col in columns:
        if col.detected_type == "categorical" and col.top_values:
            top = col.top_values[0]
            insights.append(
                f"The most common **{col.name}** is \"{top['value']}\" "
                f"({top['count']:,} occurrences)."
            )

    return insights[:10]  # Cap at 10 insights


# ── Chart Suggestions ────────────────────────────────────────────────────────

def _suggest_charts(
    df: pd.DataFrame, columns: list[ColumnProfile], domain: str
) -> list[ChartSuggestion]:
    """Generate smart chart suggestions based on data characteristics."""
    suggestions: list[ChartSuggestion] = []

    cat_cols = [c for c in columns if c.detected_type == "categorical" and c.unique <= 15]
    num_cols = [c for c in columns if c.numeric]
    date_cols = [c for c in columns if c.detected_type == "datetime"]

    # Bar chart: categorical vs count
    for cat in cat_cols[:2]:
        value_counts = df[cat.name].value_counts().head(10)
        suggestions.append(ChartSuggestion(
            title=f"{cat.name} Distribution",
            chart_type="bar",
            x_key="name",
            y_key="value",
            data=[{"name": str(k), "value": int(v)} for k, v in value_counts.items()],
            reasoning=f"Shows the distribution of {cat.name} categories.",
            config={"xLabel": cat.name, "yLabel": "Count", "palette": "cyan"},
        ))

    # Pie chart: categorical with few categories
    for cat in cat_cols[:1]:
        if cat.unique <= 8:
            value_counts = df[cat.name].value_counts().head(8)
            suggestions.append(ChartSuggestion(
                title=f"{cat.name} Breakdown",
                chart_type="pie",
                x_key="name",
                y_key="value",
                data=[{"name": str(k), "value": int(v)} for k, v in value_counts.items()],
                reasoning=f"Pie chart works well for {cat.name} since it has {cat.unique} categories.",
                config={"showLegend": True},
            ))

    # Line chart: temporal data
    if date_cols and num_cols:
        try:
            date_col = date_cols[0]
            num_col = num_cols[0]
            temp_df = df[[date_col.name, num_col.name]].dropna().copy()
            temp_df[date_col.name] = pd.to_datetime(temp_df[date_col.name], errors="coerce")
            temp_df[num_col.name] = _coerce_numeric_series(temp_df[num_col.name])
            temp_df = temp_df.dropna()
            if len(temp_df) > 2:
                grouped = temp_df.groupby(temp_df[date_col.name].dt.to_period("M"))[num_col.name].mean()
                data_points = [
                    {"name": str(period), "value": round(float(val), 2)}
                    for period, val in grouped.head(24).items()
                ]
                if data_points:
                    suggestions.append(ChartSuggestion(
                        title=f"{num_col.name} Over Time",
                        chart_type="line",
                        x_key="name",
                        y_key="value",
                        data=data_points,
                        reasoning=f"Shows {num_col.name} trends over time.",
                        config={"xLabel": "Period", "yLabel": num_col.name, "curved": True},
                    ))
        except Exception:
            pass

    # Scatter plot: numeric vs numeric
    if len(num_cols) >= 2:
        col_a, col_b = num_cols[0], num_cols[1]
        try:
            sample = df[[col_a.name, col_b.name]].copy()
            sample[col_a.name] = _coerce_numeric_series(sample[col_a.name])
            sample[col_b.name] = _coerce_numeric_series(sample[col_b.name])
            sample = sample.dropna().head(100)
            if len(sample) > 5:
                suggestions.append(ChartSuggestion(
                    title=f"{col_a.name} vs {col_b.name}",
                    chart_type="scatter",
                    x_key=col_a.name,
                    y_key=col_b.name,
                    data=sample.to_dict("records"),
                    reasoning=f"Scatter plot to explore relationship between {col_a.name} and {col_b.name}.",
                    config={"xLabel": col_a.name, "yLabel": col_b.name},
                ))
        except Exception:
            pass

    # Bar chart: numeric aggregation by category
    if cat_cols and num_cols:
        cat = cat_cols[0]
        num = num_cols[0]
        try:
            grouped_df = df[[cat.name, num.name]].copy()
            grouped_df[num.name] = _coerce_numeric_series(grouped_df[num.name])
            grouped = (
                grouped_df.dropna()
                .groupby(cat.name)[num.name]
                .mean()
                .sort_values(ascending=False)
                .head(10)
            )
            suggestions.append(ChartSuggestion(
                title=f"Average {num.name} by {cat.name}",
                chart_type="bar",
                x_key="name",
                y_key="value",
                data=[{"name": str(k), "value": round(float(v), 2)} for k, v in grouped.items()],
                reasoning=f"Compares average {num.name} across {cat.name} categories.",
                config={"xLabel": cat.name, "yLabel": f"Avg {num.name}", "palette": "violet"},
            ))
        except Exception:
            pass

    return suggestions[:6]  # Cap at 6 chart suggestions


# ── Main Profiling Function ──────────────────────────────────────────────────

def profile_dataframe(df: pd.DataFrame, file_name: str = "dataset.csv") -> DatasetSummary:
    """
    Profile an entire DataFrame and return a comprehensive summary.

    This is the main entry point — takes a raw DataFrame and produces
    column profiles, KPIs, insights, and chart suggestions.
    """
    column_profiles = [_profile_column(df, col) for col in df.columns]
    domain = _detect_domain(list(df.columns))
    kpis = _generate_kpis(df, column_profiles)
    insights = _generate_insights(df, column_profiles, domain)
    chart_suggestions = _suggest_charts(df, column_profiles, domain)

    return DatasetSummary(
        row_count=len(df),
        column_count=len(df.columns),
        columns=column_profiles,
        kpis=kpis,
        insights=insights,
        chart_suggestions=chart_suggestions,
        domain=domain,
    )

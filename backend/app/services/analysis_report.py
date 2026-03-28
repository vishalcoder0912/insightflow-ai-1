"""Comprehensive Analysis Report Generator — Professional Data Analyst Reports.

Generates complete analysis reports with:
- Data Overview & Schema
- Key KPIs (5-10) with formulas
- Insights & Trends
- 6 Dashboard Charts with explanations
- Advanced Analysis (segmentation, correlations)
- Python code for dashboard generation
"""

from __future__ import annotations

import re
from typing import Any, Optional
from datetime import datetime

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

from app.models.schemas import (
    ColumnProfile,
    ChartSuggestion,
    KPI,
    ComprehensiveReport,
    DataOverview,
    KPIMetric,
    Insight,
    DashboardChart,
    AdvancedAnalysis,
    SegmentationResult,
    CorrelationFinding,
    TrendFinding,
    AnomalyFinding,
    PythonDashboardCode,
)


# ── Domain Detection ─────────────────────────────────────────────────────────

_DOMAIN_KEYWORDS = {
    "sales": ["revenue", "sales", "order", "customer", "product", "price", "quantity", "amount", "total"],
    "finance": ["profit", "cost", "expense", "budget", "tax", "income", "asset", "liability", "transaction"],
    "marketing": ["campaign", "click", "impression", "conversion", "channel", "ad", "roi", "ctr", "cpc"],
    "hr": ["employee", "salary", "department", "hire", "position", "manager", "attendance", "performance"],
    "healthcare": ["patient", "diagnosis", "treatment", "hospital", "medical", "health", "drug", "dosage"],
    "ecommerce": ["product", "cart", "checkout", "shipping", "payment", "order", "inventory", "sku"],
    "education": ["student", "grade", "course", "school", "teacher", "exam", "score", "enrollment"],
    "logistics": ["shipment", "delivery", "warehouse", "route", "vehicle", "package", "tracking"],
    "general": [],
}

_DOMAIN_KPI_TEMPLATES = {
    "sales": [
        {"label": "Total Revenue", "formula": "SUM(revenue)", "icon": "dollar-sign"},
        {"label": "Average Order Value", "formula": "AVG(order_total)", "icon": "shopping-cart"},
        {"label": "Total Orders", "formula": "COUNT(orders)", "icon": "package"},
        {"label": "Customer Count", "formula": "COUNT(DISTINCT customers)", "icon": "users"},
    ],
    "finance": [
        {"label": "Total Profit", "formula": "SUM(profit)", "icon": "trending-up"},
        {"label": "Average Transaction", "formula": "AVG(amount)", "icon": "credit-card"},
        {"label": "Expense Ratio", "formula": "expenses/revenue * 100", "icon": "percent"},
    ],
    "marketing": [
        {"label": "Total Conversions", "formula": "SUM(conversions)", "icon": "target"},
        {"label": "Click-Through Rate", "formula": "clicks/impressions * 100", "icon": "mouse-pointer"},
        {"label": "Cost Per Click", "formula": "cost/clicks", "icon": "dollar-sign"},
    ],
    "hr": [
        {"label": "Total Employees", "formula": "COUNT(employees)", "icon": "users"},
        {"label": "Average Salary", "formula": "AVG(salary)", "icon": "dollar-sign"},
        {"label": "Department Count", "formula": "COUNT(DISTINCT departments)", "icon": "building"},
    ],
    "general": [],
}


# ── Column Type Detection ────────────────────────────────────────────────────

_DATE_PATTERNS = [
    r"\d{4}-\d{2}-\d{2}",
    r"\d{2}/\d{2}/\d{4}",
    r"\d{2}-\d{2}-\d{4}",
    r"\d{4}/\d{2}/\d{2}",
]


def _detect_column_type(series: pd.Series) -> str:
    """Detect semantic type of a column."""
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
            1 for val in sample
            if any(re.match(pat, str(val).strip()) for pat in _DATE_PATTERNS)
        )
        if date_matches / len(sample) > 0.7:
            return "datetime"
    
    # Check if numeric stored as string
    try:
        pd.to_numeric(series.dropna().head(50))
        return "numeric"
    except (ValueError, TypeError):
        pass
    
    nunique = series.nunique()
    total = len(series.dropna())
    if total > 0:
        if nunique / total < 0.05 and nunique <= 2:
            return "boolean"
        if nunique / total < 0.5 and nunique <= 50:
            return "categorical"
    
    return "text"


def _detect_domain(columns: list[str]) -> str:
    """Detect the probable domain of the dataset."""
    col_text = " ".join(c.lower().replace("_", " ") for c in columns)
    scores = {}
    for domain, keywords in _DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for kw in keywords if kw in col_text)
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "general"


# ── Data Overview Generation ────────────────────────────────────────────────

def _generate_data_overview(df: pd.DataFrame, columns: list[ColumnProfile], domain: str) -> DataOverview:
    """Generate comprehensive data overview section."""
    
    # Schema description
    numeric_count = sum(1 for c in columns if c.detected_type == "numeric")
    categorical_count = sum(1 for c in columns if c.detected_type == "categorical")
    datetime_count = sum(1 for c in columns if c.detected_type == "datetime")
    text_count = sum(1 for c in columns if c.detected_type == "text")
    
    schema_desc = (
        f"The dataset contains {len(columns)} columns: "
        f"{numeric_count} numeric, {categorical_count} categorical, "
        f"{datetime_count} datetime, and {text_count} text fields."
    )
    
    # Key fields identification
    key_fields = []
    for col in columns:
        if col.detected_type == "numeric" and col.sum is not None and col.sum > 0:
            key_fields.append({
                "name": col.name,
                "type": "metric",
                "description": f"Key numeric metric ranging from {col.min} to {col.max}"
            })
        elif col.detected_type == "categorical" and col.unique <= 20:
            key_fields.append({
                "name": col.name,
                "type": "dimension",
                "description": f"Categorical dimension with {col.unique} unique values"
            })
        elif col.detected_type == "datetime":
            key_fields.append({
                "name": col.name,
                "type": "temporal",
                "description": "Time-based field for trend analysis"
            })
    
    # Data quality summary
    total_cells = len(df) * len(columns)
    missing_cells = sum(c.missing for c in columns)
    completeness = ((total_cells - missing_cells) / total_cells * 100) if total_cells > 0 else 100
    
    duplicate_rows = df.duplicated().sum()
    
    quality_issues = []
    if completeness < 95:
        quality_issues.append(f"Missing data: {100 - completeness:.1f}% of cells are empty")
    if duplicate_rows > 0:
        quality_issues.append(f"Duplicate rows: {duplicate_rows} found")
    
    columns_with_missing = [c for c in columns if c.missing > 0]
    if columns_with_missing:
        worst = max(columns_with_missing, key=lambda c: c.missing)
        quality_issues.append(f"'{worst.name}' has most missing values ({worst.missing})")
    
    return DataOverview(
        row_count=len(df),
        column_count=len(columns),
        domain=domain,
        schema_description=schema_desc,
        key_fields=key_fields[:10],
        data_quality={
            "completeness": round(completeness, 2),
            "duplicate_rows": int(duplicate_rows),
            "issues": quality_issues if quality_issues else ["No significant data quality issues detected"],
        },
        column_summary=[
            {
                "name": c.name,
                "type": c.detected_type,
                "missing": c.missing,
                "unique": c.unique,
                "sample": c.sample_values[:3],
            }
            for c in columns
        ],
    )


# ── KPI Generation ──────────────────────────────────────────────────────────

def _generate_kpis(df: pd.DataFrame, columns: list[ColumnProfile], domain: str) -> list[KPIMetric]:
    """Generate domain-specific KPIs with formulas and interpretations."""
    kpis: list[KPIMetric] = []
    
    # Headline KPI - most important metric
    numeric_cols = [c for c in columns if c.numeric and c.sum is not None and c.sum > 0]
    
    if numeric_cols:
        # Pick the most significant numeric column as headline
        headline_col = max(numeric_cols, key=lambda c: c.sum if c.sum else 0)
        kpis.append(KPIMetric(
            label=f"Total {headline_col.name.replace('_', ' ').title()}",
            value=f"{headline_col.sum:,.2f}",
            formula=f"SUM({headline_col.name})",
            interpretation=f"This is the headline KPI representing the total {headline_col.name} across all records.",
            is_headline=True,
            icon="star",
            trend="up" if headline_col.average and headline_col.average > 0 else "stable",
        ))
    
    # Total Records
    kpis.append(KPIMetric(
        label="Total Records",
        value=f"{len(df):,}",
        formula="COUNT(*)",
        interpretation="Total number of data points in the dataset.",
        is_headline=False,
        icon="database",
    ))
    
    # Average metrics
    for col in numeric_cols[:3]:
        if col.average is not None:
            kpis.append(KPIMetric(
                label=f"Average {col.name.replace('_', ' ').title()}",
                value=f"{col.average:,.2f}",
                formula=f"AVG({col.name})",
                interpretation=f"The mean {col.name} across all records. Median is {col.median:,.2f}.",
                is_headline=False,
                icon="bar-chart",
            ))
    
    # Data Completeness
    total_cells = len(df) * len(columns)
    missing = sum(c.missing for c in columns)
    completeness = ((total_cells - missing) / total_cells * 100) if total_cells > 0 else 100
    
    kpis.append(KPIMetric(
        label="Data Completeness",
        value=f"{completeness:.1f}%",
        formula="(Filled Cells / Total Cells) × 100",
        interpretation=f"{missing:,} missing values out of {total_cells:,} total cells.",
        is_headline=False,
        icon="check-circle" if completeness > 95 else "alert-triangle",
    ))
    
    # Unique categories
    cat_cols = [c for c in columns if c.detected_type == "categorical"]
    for col in cat_cols[:2]:
        kpis.append(KPIMetric(
            label=f"Unique {col.name.replace('_', ' ').title()}",
            value=str(col.unique),
            formula=f"COUNT(DISTINCT {col.name})",
            interpretation=f"Number of distinct categories in {col.name}.",
            is_headline=False,
            icon="layers",
        ))
    
    # Variability KPI
    for col in numeric_cols[:2]:
        if col.std is not None and col.average is not None and col.average != 0:
            cv = (col.std / abs(col.average)) * 100
            variability = "High" if cv > 50 else "Moderate" if cv > 20 else "Low"
            kpis.append(KPIMetric(
                label=f"{col.name.replace('_', ' ').title()} Variability",
                value=f"{variability} (CV: {cv:.1f}%)",
                formula=f"(STDDEV / MEAN) × 100",
                interpretation=f"Coefficient of variation indicates {'high spread' if cv > 50 else 'moderate spread' if cv > 20 else 'consistent values'} in the data.",
                is_headline=False,
                icon="activity",
            ))
    
    return kpis[:10]


# ── Insights Generation ────────────────────────────────────────────────────

def _generate_insights(df: pd.DataFrame, columns: list[ColumnProfile], domain: str) -> list[Insight]:
    """Generate actionable insights with business implications."""
    insights: list[Insight] = []
    
    # Domain context
    domain_context = f"This {domain} dataset" if domain != "general" else "This dataset"
    
    # Overview insight
    numeric_cols = [c for c in columns if c.numeric]
    cat_cols = [c for c in columns if c.detected_type == "categorical"]
    
    insights.append(Insight(
        category="overview",
        title="Dataset Composition",
        content=f"{domain_context} contains {len(df):,} records with {len(columns)} attributes ({len(numeric_cols)} metrics, {len(cat_cols)} dimensions).",
        business_implication="Understanding data composition helps identify analysis opportunities and potential limitations.",
        importance="high",
    ))
    
    # Numeric insights with patterns
    for col in numeric_cols:
        if col.min is not None and col.max is not None:
            spread = col.max - col.min
            
            # Check for skewness
            if col.std and col.average and col.average != 0:
                series = pd.to_numeric(df[col.name], errors="coerce").dropna()
                if len(series) > 10:
                    skew = series.skew()
                    if abs(skew) > 1:
                        direction = "right-skewed" if skew > 0 else "left-skewed"
                        insights.append(Insight(
                            category="distribution",
                            title=f"{col.name} Distribution Pattern",
                            content=f"**{col.name}** is {direction} (skewness: {skew:.2f}), ranging from {col.min:,.2f} to {col.max:,.2f} with average {col.average:,.2f}.",
                            business_implication=f"Skewed distribution suggests {'many low values with few high outliers' if skew > 0 else 'many high values with few low outliers'}. Consider investigating extreme values.",
                            importance="medium",
                        ))
                    else:
                        insights.append(Insight(
                            category="distribution",
                            title=f"{col.name} Range Analysis",
                            content=f"**{col.name}** ranges from {col.min:,.2f} to {col.max:,.2f} with average {col.average:,.2f} and standard deviation {col.std:.2f}.",
                            business_implication="Normal distribution indicates consistent data patterns suitable for statistical analysis.",
                            importance="low",
                        ))
    
    # Categorical insights
    for col in cat_cols:
        if col.top_values and len(col.top_values) > 0:
            top = col.top_values[0]
            total = sum(tv["count"] for tv in col.top_values)
            percentage = (top["count"] / total * 100) if total > 0 else 0
            
            insights.append(Insight(
                category="pattern",
                title=f"Top {col.name} Category",
                content=f"**{top['value']}** is the most common {col.name} with {top['count']:,} occurrences ({percentage:.1f}% of data).",
                business_implication=f"Dominant category suggests potential focus area for analysis or business strategy.",
                importance="medium",
            ))
    
    # Missing data insights
    cols_with_missing = [c for c in columns if c.missing > 0]
    if cols_with_missing:
        worst = max(cols_with_missing, key=lambda c: c.missing)
        pct = (worst.missing / (worst.filled + worst.missing)) * 100
        
        insights.append(Insight(
            category="quality",
            title="Data Quality Alert",
            content=f"**{worst.name}** has {worst.missing:,} missing values ({pct:.1f}% missing).",
            business_implication="Missing data may affect analysis accuracy. Consider data imputation or filtering strategies.",
            importance="high" if pct > 10 else "medium",
        ))
    
    # Anomaly detection
    for col in numeric_cols[:3]:
        series = pd.to_numeric(df[col.name], errors="coerce").dropna()
        if len(series) > 10:
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            iqr = q3 - q1
            outliers = ((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum()
            
            if outliers > 0 and outliers / len(series) > 0.01:
                insights.append(Insight(
                    category="anomaly",
                    title=f"Outliers Detected in {col.name}",
                    content=f"Found {outliers:,} potential outliers ({outliers/len(series)*100:.1f}%) in **{col.name}** using IQR method.",
                    business_implication="Outliers may represent errors or significant business events. Investigate before making decisions.",
                    importance="medium",
                ))
    
    return insights[:12]


# ── Dashboard Charts Generation ────────────────────────────────────────────

def _generate_dashboard_charts(df: pd.DataFrame, columns: list[ColumnProfile], domain: str) -> list[DashboardChart]:
    """Generate exactly 6 dashboard-ready chart specifications."""
    charts: list[DashboardChart] = []
    
    cat_cols = [c for c in columns if c.detected_type == "categorical" and c.unique <= 20]
    num_cols = [c for c in columns if c.numeric]
    date_cols = [c for c in columns if c.detected_type == "datetime"]
    
    # Chart 1: Bar chart - Top categories
    if cat_cols:
        cat = cat_cols[0]
        value_counts = df[cat.name].value_counts().head(10)
        charts.append(DashboardChart(
            title=f"{cat.name.replace('_', ' ').title()} Distribution",
            chart_type="bar",
            x_axis=cat.name,
            y_axis="Count",
            data=[{"name": str(k), "value": int(v)} for k, v in value_counts.items()],
            insight_shown=f"Shows the frequency distribution of {cat.name}. The most common value is '{value_counts.index[0]}' with {value_counts.iloc[0]} occurrences.",
            why_useful="Bar charts are ideal for comparing categorical frequencies and identifying dominant categories.",
            config={"palette": "cyan", "showGrid": True},
        ))
    
    # Chart 2: Pie chart - Category breakdown
    if cat_cols and cat_cols[0].unique <= 8:
        cat = cat_cols[0]
        value_counts = df[cat.name].value_counts().head(8)
        charts.append(DashboardChart(
            title=f"{cat.name.replace('_', ' ').title()} Breakdown",
            chart_type="pie",
            x_axis=cat.name,
            y_axis="Percentage",
            data=[{"name": str(k), "value": int(v)} for k, v in value_counts.items()],
            insight_shown=f"Proportional view of {cat.name} distribution. Useful for understanding market share or segment composition.",
            why_useful="Pie charts effectively communicate proportional relationships when categories are few (≤8).",
            config={"showLegend": True, "showLabels": True},
        ))
    
    # Chart 3: Line chart - Trend over time
    if date_cols and num_cols:
        date_col = date_cols[0]
        num_col = num_cols[0]
        try:
            temp_df = df[[date_col.name, num_col.name]].dropna().copy()
            temp_df[date_col.name] = pd.to_datetime(temp_df[date_col.name], errors="coerce")
            temp_df = temp_df.dropna().sort_values(date_col.name)
            
            if len(temp_df) > 2:
                grouped = temp_df.groupby(temp_df[date_col.name].dt.to_period("M"))[num_col.name].mean()
                data_points = [
                    {"name": str(period), "value": round(float(val), 2)}
                    for period, val in grouped.head(24).items()
                ]
                if data_points:
                    charts.append(DashboardChart(
                        title=f"{num_col.name.replace('_', ' ').title()} Trend Over Time",
                        chart_type="line",
                        x_axis="Period",
                        y_axis=num_col.name,
                        data=data_points,
                        insight_shown=f"Shows how {num_col.name} has changed over time. Look for upward/downward trends or seasonality.",
                        why_useful="Line charts reveal trends, patterns, and seasonality in time-series data.",
                        config={"curved": True, "showDots": True, "palette": "emerald"},
                    ))
        except Exception:
            pass
    
    # Chart 4: Scatter plot - Correlation exploration
    if len(num_cols) >= 2:
        col_a, col_b = num_cols[0], num_cols[1]
        try:
            sample = df[[col_a.name, col_b.name]].dropna().head(100)
            if len(sample) > 5:
                # Calculate correlation
                corr = sample[col_a.name].corr(sample[col_b.name])
                charts.append(DashboardChart(
                    title=f"{col_a.name.replace('_', ' ').title()} vs {col_b.name.replace('_', ' ').title()}",
                    chart_type="scatter",
                    x_axis=col_a.name,
                    y_axis=col_b.name,
                    data=[
                        {"name": f"Point {i}", "x": float(row[col_a.name]), "y": float(row[col_b.name])}
                        for i, row in sample.iterrows()
                    ],
                    insight_shown=f"Explores relationship between {col_a.name} and {col_b.name}. Correlation coefficient: {corr:.2f}.",
                    why_useful="Scatter plots reveal correlations, clusters, and outliers between two numeric variables.",
                    config={"palette": "amber"},
                ))
        except Exception:
            pass
    
    # Chart 5: Bar chart - Numeric by category
    if cat_cols and num_cols:
        cat = cat_cols[0]
        num = num_cols[0]
        try:
            grouped = df.groupby(cat.name)[num.name].mean().sort_values(ascending=False).head(10)
            charts.append(DashboardChart(
                title=f"Average {num.name.replace('_', ' ').title()} by {cat.name.replace('_', ' ').title()}",
                chart_type="bar",
                x_axis=cat.name,
                y_axis=f"Average {num.name}",
                data=[{"name": str(k), "value": round(float(v), 2)} for k, v in grouped.items()],
                insight_shown=f"Compares average {num.name} across {cat.name} categories. Top performer: '{grouped.index[0]}' with {grouped.iloc[0]:.2f}.",
                why_useful="Segmented analysis reveals which categories perform best on key metrics.",
                config={"palette": "violet", "showGrid": True},
            ))
        except Exception:
            pass
    
    # Chart 6: Histogram - Distribution
    if num_cols:
        num = num_cols[0]
        try:
            series = pd.to_numeric(df[num.name], errors="coerce").dropna()
            counts, bin_edges = np.histogram(series, bins=15)
            hist_data = [
                {"name": f"{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}", "value": int(counts[i])}
                for i in range(len(counts))
            ]
            
            charts.append(DashboardChart(
                title=f"{num.name.replace('_', ' ').title()} Distribution",
                chart_type="bar",  # Histogram as bar chart
                x_axis=num.name,
                y_axis="Frequency",
                data=hist_data,
                insight_shown=f"Shows the distribution shape of {num.name}. Look for normal, skewed, or multimodal patterns.",
                why_useful="Histograms reveal the underlying distribution of numeric data, essential for statistical analysis.",
                config={"palette": "blue", "showGrid": True},
            ))
        except Exception:
            pass
    
    # Ensure exactly 6 charts
    while len(charts) < 6:
        # Add placeholder charts if needed
        remaining = 6 - len(charts)
        if num_cols and remaining > 0:
            col = num_cols[len(charts) % len(num_cols)]
            charts.append(DashboardChart(
                title=f"{col.name.replace('_', ' ').title()} Summary",
                chart_type="bar",
                x_axis="Category",
                y_axis=col.name,
                data=[{"name": "Total", "value": col.sum or 0}],
                insight_shown=f"Summary statistics for {col.name}.",
                why_useful="Provides key metric overview.",
                config={"palette": "cyan"},
            ))
    
    return charts[:6]


# ── Advanced Analysis ──────────────────────────────────────────────────────

def _generate_advanced_analysis(df: pd.DataFrame, columns: list[ColumnProfile]) -> AdvancedAnalysis:
    """Generate advanced analysis with segmentation, correlations, trends, and anomalies."""
    
    numeric_cols = [c for c in columns if c.numeric]
    cat_cols = [c for c in columns if c.detected_type == "categorical"]
    date_cols = [c for c in columns if c.detected_type == "datetime"]
    
    # Segmentation
    segmentation_results = []
    if cat_cols and numeric_cols:
        for cat in cat_cols[:3]:
            for num in numeric_cols[:2]:
                try:
                    grouped = df.groupby(cat.name)[num.name].agg(["mean", "count", "std"]).reset_index()
                    segments = [
                        {
                            "segment": str(row[cat.name]),
                            "metric": num.name,
                            "mean": round(float(row["mean"]), 2),
                            "count": int(row["count"]),
                            "std": round(float(row["std"]), 2) if not pd.isna(row["std"]) else 0,
                        }
                        for _, row in grouped.iterrows()
                    ]
                    if segments:
                        segmentation_results.append(SegmentationResult(
                            dimension=cat.name,
                            metric=num.name,
                            segments=segments[:10],
                            insight=f"Segmented {num.name} by {cat.name} reveals performance differences across categories.",
                        ))
                except Exception:
                    pass
    
    # Correlations
    correlation_findings = []
    if len(numeric_cols) >= 2:
        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.shape[1] >= 2:
            corr_matrix = numeric_df.corr()
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    r = corr_matrix.iloc[i, j]
                    if not pd.isna(r) and abs(r) > 0.5:
                        correlation_findings.append(CorrelationFinding(
                            column_a=corr_matrix.columns[i],
                            column_b=corr_matrix.columns[j],
                            correlation=round(float(r), 4),
                            strength="strong" if abs(r) > 0.7 else "moderate",
                            direction="positive" if r > 0 else "negative",
                            interpretation=f"{'Strong' if abs(r) > 0.7 else 'Moderate'} {'positive' if r > 0 else 'negative'} correlation suggests these variables move {'together' if r > 0 else 'in opposite directions'}.",
                        ))
    
    # Trends
    trend_findings = []
    if date_cols and numeric_cols:
        for date_col in date_cols[:1]:
            for num_col in numeric_cols[:2]:
                try:
                    temp_df = df[[date_col.name, num_col.name]].dropna().copy()
                    temp_df[date_col.name] = pd.to_datetime(temp_df[date_col.name], errors="coerce")
                    temp_df = temp_df.dropna().sort_values(date_col.name)
                    
                    if len(temp_df) > 3:
                        grouped = temp_df.groupby(temp_df[date_col.name].dt.to_period("M"))[num_col.name].mean()
                        values = grouped.values.astype(float)
                        x = np.arange(len(values))
                        slope, _, r_value, _, _ = scipy_stats.linregress(x, values)
                        
                        direction = "increasing" if slope > 0 else "decreasing" if slope < 0 else "stable"
                        trend_findings.append(TrendFinding(
                            column=num_col.name,
                            temporal_column=date_col.name,
                            direction=direction,
                            slope=round(float(slope), 6),
                            r_squared=round(float(r_value ** 2), 4),
                            interpretation=f"{num_col.name} shows an {direction} trend over time (R²={r_value**2:.2f}).",
                        ))
                except Exception:
                    pass
    
    # Anomalies
    anomaly_findings = []
    for col in numeric_cols[:5]:
        try:
            series = pd.to_numeric(df[col.name], errors="coerce").dropna()
            if len(series) > 10:
                q1, q3 = series.quantile(0.25), series.quantile(0.75)
                iqr = q3 - q1
                lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                outliers = series[(series < lower) | (series > upper)]
                
                if len(outliers) > 0:
                    anomaly_findings.append(AnomalyFinding(
                        column=col.name,
                        anomaly_type="outlier",
                        count=len(outliers),
                        percentage=round(len(outliers) / len(series) * 100, 2),
                        bounds={"lower": round(lower, 2), "upper": round(upper, 2)},
                        sample_values=[round(float(v), 2) for v in outliers.head(5).tolist()],
                        recommendation="Investigate outliers to determine if they represent errors or significant business events.",
                    ))
        except Exception:
            pass
    
    return AdvancedAnalysis(
        segmentation=segmentation_results[:6],
        correlations=correlation_findings[:5],
        trends=trend_findings[:3],
        anomalies=anomaly_findings[:5],
    )


# ── Python Code Generator ──────────────────────────────────────────────────

def _generate_python_code(df: pd.DataFrame, columns: list[ColumnProfile]) -> PythonDashboardCode:
    """Generate executable Python code for creating all 6 dashboard charts."""
    
    cat_cols = [c for c in columns if c.detected_type == "categorical" and c.unique <= 20]
    num_cols = [c for c in columns if c.numeric]
    date_cols = [c for c in columns if c.detected_type == "datetime"]
    
    code_lines = [
        '"""Dashboard Visualization Code - Auto-generated by InsightFlow AI"""',
        '',
        'import pandas as pd',
        'import matplotlib.pyplot as plt',
        'import seaborn as sns',
        'import numpy as np',
        '',
        '# Set style',
        'plt.style.use("seaborn-v0_8-whitegrid")',
        'sns.set_palette("husl")',
        '',
        '# Load your data',
        '# df = pd.read_csv("your_dataset.csv")',
        '',
        '# Create figure with 2x3 subplots',
        'fig, axes = plt.subplots(2, 3, figsize=(18, 12))',
        'fig.suptitle("Data Analysis Dashboard", fontsize=16, fontweight="bold")',
        '',
    ]
    
    # Chart 1: Bar chart
    if cat_cols:
        cat = cat_cols[0]
        code_lines.extend([
            f'# Chart 1: {cat.name} Distribution',
            f'ax1 = axes[0, 0]',
            f'value_counts = df["{cat.name}"].value_counts().head(10)',
            f'value_counts.plot(kind="bar", ax=ax1, color="steelblue")',
            f'ax1.set_title("{cat.name.replace("_", " ").title()} Distribution")',
            f'ax1.set_xlabel("{cat.name}")',
            f'ax1.set_ylabel("Count")',
            f'ax1.tick_params(axis="x", rotation=45)',
            '',
        ])
    
    # Chart 2: Pie chart
    if cat_cols and cat_cols[0].unique <= 8:
        cat = cat_cols[0]
        code_lines.extend([
            f'# Chart 2: {cat.name} Breakdown',
            f'ax2 = axes[0, 1]',
            f'pie_data = df["{cat.name}"].value_counts().head(8)',
            f'ax2.pie(pie_data.values, labels=pie_data.index, autopct="%1.1f%%", startangle=90)',
            f'ax2.set_title("{cat.name.replace("_", " ").title()} Breakdown")',
            '',
        ])
    
    # Chart 3: Line chart
    if date_cols and num_cols:
        date_col = date_cols[0]
        num_col = num_cols[0]
        code_lines.extend([
            f'# Chart 3: {num_col.name} Trend Over Time',
            f'ax3 = axes[0, 2]',
            f'temp_df = df[["{date_col.name}", "{num_col.name}"]].dropna().copy()',
            f'temp_df["{date_col.name}"] = pd.to_datetime(temp_df["{date_col.name}"], errors="coerce")',
            f'temp_df = temp_df.dropna().sort_values("{date_col.name}")',
            f'grouped = temp_df.groupby(temp_df["{date_col.name}"].dt.to_period("M"))["{num_col.name}"].mean()',
            f'ax3.plot(range(len(grouped)), grouped.values, marker="o", linewidth=2, color="forestgreen")',
            f'ax3.set_title("{num_col.name.replace("_", " ").title()} Trend Over Time")',
            f'ax3.set_xlabel("Period")',
            f'ax3.set_ylabel("{num_col.name}")',
            '',
        ])
    
    # Chart 4: Scatter plot
    if len(num_cols) >= 2:
        col_a, col_b = num_cols[0], num_cols[1]
        code_lines.extend([
            f'# Chart 4: {col_a.name} vs {col_b.name}',
            f'ax4 = axes[1, 0]',
            f'sample = df[["{col_a.name}", "{col_b.name}"]].dropna().head(100)',
            f'ax4.scatter(sample["{col_a.name}"], sample["{col_b.name}"], alpha=0.6, color="coral")',
            f'ax4.set_title("{col_a.name.replace("_", " ").title()} vs {col_b.name.replace("_", " ").title()}")',
            f'ax4.set_xlabel("{col_a.name}")',
            f'ax4.set_ylabel("{col_b.name}")',
            '',
        ])
    
    # Chart 5: Bar chart - Numeric by category
    if cat_cols and num_cols:
        cat = cat_cols[0]
        num = num_cols[0]
        code_lines.extend([
            f'# Chart 5: Average {num.name} by {cat.name}',
            f'ax5 = axes[1, 1]',
            f'grouped = df.groupby("{cat.name}")["{num.name}"].mean().sort_values(ascending=False).head(10)',
            f'grouped.plot(kind="bar", ax=ax5, color="mediumpurple")',
            f'ax5.set_title("Average {num.name.replace("_", " ").title()} by {cat.name.replace("_", " ").title()}")',
            f'ax5.set_xlabel("{cat.name}")',
            f'ax5.set_ylabel("Average {num.name}")',
            f'ax5.tick_params(axis="x", rotation=45)',
            '',
        ])
    
    # Chart 6: Histogram
    if num_cols:
        num = num_cols[0]
        code_lines.extend([
            f'# Chart 6: {num.name} Distribution Histogram',
            f'ax6 = axes[1, 2]',
            f'ax6.hist(df["{num.name}"].dropna(), bins=15, color="steelblue", edgecolor="black", alpha=0.7)',
            f'ax6.set_title("{num.name.replace("_", " ").title()} Distribution")',
            f'ax6.set_xlabel("{num.name}")',
            f'ax6.set_ylabel("Frequency")',
            '',
        ])
    
    code_lines.extend([
        '# Adjust layout and save',
        'plt.tight_layout()',
        'plt.savefig("dashboard.png", dpi=150, bbox_inches="tight")',
        'plt.show()',
        '',
        'print("Dashboard saved to dashboard.png")',
    ])
    
    full_code = "\n".join(code_lines)
    
    return PythonDashboardCode(
        code=full_code,
        libraries=["pandas", "matplotlib", "seaborn", "numpy"],
        instructions=[
            "Install required libraries: pip install pandas matplotlib seaborn numpy",
            "Replace the data loading line with your actual CSV file path",
            "Run the script to generate a dashboard PNG image",
            "Customize colors and styling as needed",
        ],
    )


# ── Main Entry Point ────────────────────────────────────────────────────────

def generate_comprehensive_report(df: pd.DataFrame, file_name: str = "dataset.csv") -> ComprehensiveReport:
    """
    Generate a complete professional data analysis report.
    
    This is the main entry point that orchestrates all analysis components.
    """
    # Profile columns
    column_profiles = []
    for col in df.columns:
        series = df[col]
        detected_type = _detect_column_type(series)
        
        profile = ColumnProfile(
            name=col,
            dtype=str(series.dtype),
            detected_type=detected_type,
            filled=int(series.notna().sum()),
            missing=int(series.isna().sum()),
            unique=int(series.nunique()),
            sample_values=[str(v) for v in series.dropna().head(5).tolist()],
            numeric=detected_type == "numeric",
        )
        
        if detected_type == "numeric":
            numeric_series = pd.to_numeric(series, errors="coerce").dropna()
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
        
        column_profiles.append(profile)
    
    # Detect domain
    domain = _detect_domain(list(df.columns))
    
    # Generate all sections
    data_overview = _generate_data_overview(df, column_profiles, domain)
    kpis = _generate_kpis(df, column_profiles, domain)
    insights = _generate_insights(df, column_profiles, domain)
    dashboard_charts = _generate_dashboard_charts(df, column_profiles, domain)
    advanced_analysis = _generate_advanced_analysis(df, column_profiles)
    python_code = _generate_python_code(df, column_profiles)
    
    return ComprehensiveReport(
        file_name=file_name,
        generated_at=datetime.now().isoformat(),
        domain=domain,
        data_overview=data_overview,
        kpis=kpis,
        insights=insights,
        dashboard_charts=dashboard_charts,
        advanced_analysis=advanced_analysis,
        python_code=python_code,
    )

"""Pydantic schemas for all API request/response models."""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Column & Summary Models ──────────────────────────────────────────────────

class ColumnProfile(BaseModel):
    """Profile for a single column in the dataset."""
    name: str
    dtype: str = ""
    detected_type: str = ""  # "numeric", "categorical", "datetime", "text", "boolean"
    filled: int = 0
    missing: int = 0
    unique: int = 0
    sample_values: list[str] = Field(default_factory=list)
    numeric: bool = False
    min: Optional[float] = None
    max: Optional[float] = None
    average: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    sum: Optional[float] = None
    # For categorical
    top_values: Optional[list[dict[str, Any]]] = None


class KPI(BaseModel):
    """Auto-generated KPI from the dataset."""
    label: str
    value: str
    description: str = ""
    trend: Optional[str] = None  # "up", "down", "stable"
    icon: str = "bar-chart"


class ChartSuggestion(BaseModel):
    """Smart chart suggestion based on data characteristics."""
    title: str
    chart_type: str  # "bar", "line", "pie", "area", "scatter", "heatmap"
    x_key: str
    y_key: str
    data: list[dict[str, Any]] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)
    reasoning: str = ""


class DatasetSummary(BaseModel):
    """Full summary of a profiled dataset."""
    row_count: int = 0
    column_count: int = 0
    columns: list[ColumnProfile] = Field(default_factory=list)
    kpis: list[KPI] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
    chart_suggestions: list[ChartSuggestion] = Field(default_factory=list)
    domain: str = "general"


# ── Dataset Models ───────────────────────────────────────────────────────────

class DatasetRecord(BaseModel):
    """Full dataset record stored on the server."""
    id: str = "current"
    file_name: str
    uploaded_at: str
    headers: list[str]
    total_rows: int
    preview_rows: list[list[str]] = Field(default_factory=list)
    summary: DatasetSummary = Field(default_factory=DatasetSummary)


class DatasetUploadResponse(BaseModel):
    """Response after uploading a dataset."""
    id: str = "current"
    file_name: str
    uploaded_at: str
    headers: list[str]
    total_rows: int
    preview_rows: list[list[str]] = Field(default_factory=list)
    summary: DatasetSummary


# ── Chat Models ──────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Incoming chat message."""
    message: str
    history: list[dict[str, str]] = Field(default_factory=list)


class ChatChartPayload(BaseModel):
    """Chart data returned with a chat response."""
    title: str = ""
    chart_type: str = "bar"
    x_key: str = "label"
    y_key: str = "value"
    rows: list[dict[str, Any]] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    """Full chat response with answer, SQL, insights, and chart."""
    answer: str
    sql: str = ""
    insights: list[str] = Field(default_factory=list)
    chart: Optional[ChatChartPayload] = None
    source: str = "ai"  # "ai", "text_to_sql", "fallback"
    dataset: Optional[dict[str, Any]] = None
    meta: Optional[dict[str, Any]] = None


# ── Analysis Models ──────────────────────────────────────────────────────────

class CorrelationResult(BaseModel):
    """Correlation matrix result."""
    columns: list[str]
    matrix: list[list[float]]
    strong_correlations: list[dict[str, Any]] = Field(default_factory=list)


class OutlierResult(BaseModel):
    """Outlier detection result for a column."""
    column: str
    method: str  # "iqr" or "zscore"
    outlier_count: int
    outlier_percentage: float
    outlier_indices: list[int] = Field(default_factory=list)
    bounds: dict[str, float] = Field(default_factory=dict)


class DistributionResult(BaseModel):
    """Distribution analysis for a column."""
    column: str
    histogram: list[dict[str, Any]] = Field(default_factory=list)
    stats: dict[str, Any] = Field(default_factory=dict)
    skewness: Optional[float] = None
    kurtosis: Optional[float] = None
    normality_test: Optional[dict[str, Any]] = None


class TrendResult(BaseModel):
    """Trend analysis result."""
    column: str
    temporal_column: str
    trend_direction: str  # "increasing", "decreasing", "stable", "fluctuating"
    slope: float
    data_points: list[dict[str, Any]] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    """Generic analysis response wrapper."""
    analysis_type: str
    results: Any
    summary: str = ""


# ── Comprehensive Report Models ─────────────────────────────────────────────

class DataOverview(BaseModel):
    """Data overview section of the report."""
    row_count: int
    column_count: int
    domain: str
    schema_description: str
    key_fields: list[dict[str, Any]] = Field(default_factory=list)
    data_quality: dict[str, Any] = Field(default_factory=dict)
    column_summary: list[dict[str, Any]] = Field(default_factory=list)


class KPIMetric(BaseModel):
    """Individual KPI with formula and interpretation."""
    label: str
    value: str
    formula: str
    interpretation: str
    is_headline: bool = False
    icon: str = "bar-chart"
    trend: Optional[str] = None


class Insight(BaseModel):
    """Actionable insight with business implication."""
    category: str  # "overview", "distribution", "pattern", "quality", "anomaly"
    title: str
    content: str
    business_implication: str
    importance: str = "medium"  # "high", "medium", "low"


class DashboardChart(BaseModel):
    """Dashboard chart specification with explanation."""
    title: str
    chart_type: str
    x_axis: str
    y_axis: str
    data: list[dict[str, Any]] = Field(default_factory=list)
    insight_shown: str
    why_useful: str
    config: dict[str, Any] = Field(default_factory=dict)


class SegmentationResult(BaseModel):
    """Segmentation analysis result."""
    dimension: str
    metric: str
    segments: list[dict[str, Any]] = Field(default_factory=list)
    insight: str


class CorrelationFinding(BaseModel):
    """Correlation analysis finding."""
    column_a: str
    column_b: str
    correlation: float
    strength: str
    direction: str
    interpretation: str


class TrendFinding(BaseModel):
    """Trend analysis finding."""
    column: str
    temporal_column: str
    direction: str
    slope: float
    r_squared: Optional[float] = None
    interpretation: str


class AnomalyFinding(BaseModel):
    """Anomaly detection finding."""
    column: str
    anomaly_type: str
    count: int
    percentage: float
    bounds: dict[str, float] = Field(default_factory=dict)
    sample_values: list[float] = Field(default_factory=list)
    recommendation: str


class AdvancedAnalysis(BaseModel):
    """Advanced analysis section."""
    segmentation: list[SegmentationResult] = Field(default_factory=list)
    correlations: list[CorrelationFinding] = Field(default_factory=list)
    trends: list[TrendFinding] = Field(default_factory=list)
    anomalies: list[AnomalyFinding] = Field(default_factory=list)


class PythonDashboardCode(BaseModel):
    """Generated Python code for dashboard."""
    code: str
    libraries: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)


class ComprehensiveReport(BaseModel):
    """Complete professional data analysis report."""
    file_name: str
    generated_at: str
    domain: str
    data_overview: DataOverview
    kpis: list[KPIMetric] = Field(default_factory=list)
    insights: list[Insight] = Field(default_factory=list)
    dashboard_charts: list[DashboardChart] = Field(default_factory=list)
    advanced_analysis: AdvancedAnalysis
    python_code: PythonDashboardCode

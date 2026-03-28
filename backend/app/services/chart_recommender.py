"""Chart recommender service for SQL query results."""

from __future__ import annotations

import re
from typing import Any

from app.models.schemas import ChatChartPayload


def recommend_chart_for_results(
    sql_columns: list[str],
    sql_rows: list[list[Any]],
    question: str = "",
) -> ChatChartPayload | None:
    """
    Given SQL query results, recommend the best chart and build the payload.

    Analyzes the shape and types of the result data to pick an appropriate
    visualization automatically.
    """
    if not sql_columns or not sql_rows:
        return None

    num_cols = len(sql_columns)
    num_rows = len(sql_rows)

    if num_rows == 0:
        return None

    # Determine which columns are numeric
    numeric_mask = []
    for col_idx in range(num_cols):
        sample_values = [row[col_idx] for row in sql_rows[:20] if row[col_idx] is not None]
        is_numeric = all(_is_number(v) for v in sample_values) if sample_values else False
        numeric_mask.append(is_numeric)

    numeric_cols = [sql_columns[i] for i, m in enumerate(numeric_mask) if m]
    label_cols = [sql_columns[i] for i, m in enumerate(numeric_mask) if not m]

    # Single value result - no chart needed
    if num_rows == 1 and num_cols == 1:
        return None

    # Determine chart type based on question keywords and data shape
    q_lower = question.lower()
    chart_type = "bar"  # default

    if any(kw in q_lower for kw in ["trend", "over time", "timeline", "by year", "by month"]):
        chart_type = "line"
    elif any(kw in q_lower for kw in ["distribution", "breakdown", "share", "proportion"]):
        chart_type = "pie" if num_rows <= 8 else "bar"
    elif any(kw in q_lower for kw in ["scatter", "relationship", "correlation"]):
        chart_type = "scatter"
    elif num_rows <= 6 and label_cols:
        chart_type = "pie" if "percent" in q_lower or "share" in q_lower else "bar"

    # Build chart axes from actual data shape.
    if label_cols and numeric_cols:
        x_key = label_cols[0]
        y_key = numeric_cols[0]
    elif len(numeric_cols) >= 2:
        # Numeric-only result: use first numeric as x and second as y.
        x_key = numeric_cols[0]
        y_key = numeric_cols[1]
    elif numeric_cols:
        x_key = sql_columns[0]
        y_key = numeric_cols[0]
    else:
        # No numeric column available -> not chartable.
        return None

    x_idx = sql_columns.index(x_key)
    y_idx = sql_columns.index(y_key)

    rows = []
    for row in sql_rows[:50]:  # Cap at 50 data points
        x_val = row[x_idx]
        y_val = row[y_idx]
        if x_val is not None and y_val is not None:
            numeric_y = _to_number(y_val)
            if numeric_y is None:
                continue
            numeric_x = _to_number(x_val)
            rows.append({
                "name": numeric_x if numeric_x is not None and not label_cols else str(x_val),
                "value": numeric_y,
            })

    if not rows:
        return None

    # Generate a title
    title = _generate_chart_title(x_key, y_key, chart_type, question)

    return ChatChartPayload(
        title=title,
        chart_type=chart_type,
        x_key="name",
        y_key="value",
        rows=rows,
        config={
            "xLabel": x_key,
            "yLabel": y_key,
            "palette": _pick_palette(chart_type),
            "showGrid": chart_type not in ("pie",),
            "showLegend": chart_type == "pie",
            "curved": chart_type == "line",
        },
    )


def _is_number(val: Any) -> bool:
    """Check if a value is numeric."""
    return _to_number(val) is not None


def _to_number(val: Any) -> float | None:
    """Parse numeric-like values such as 1,234, $120.50, or ₹1,200."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        numeric = float(val)
        return numeric if numeric == numeric and numeric not in (float("inf"), float("-inf")) else None

    raw = str(val).strip()
    if not raw:
        return None

    # Handle accounting negatives such as "(1,234.50)".
    is_accounting_negative = raw.startswith("(") and raw.endswith(")")
    core = raw[1:-1] if is_accounting_negative else raw

    # Remove grouping separators/currency symbols and keep digits, sign, decimal point.
    cleaned = re.sub(r"[^\d.\-+]", "", core.replace(",", ""))
    if is_accounting_negative and cleaned and not cleaned.startswith("-"):
        cleaned = f"-{cleaned}"

    try:
        numeric = float(cleaned)
        return numeric if numeric == numeric and numeric not in (float("inf"), float("-inf")) else None
    except (ValueError, TypeError):
        return None


def _generate_chart_title(x_key: str, y_key: str, chart_type: str, question: str) -> str:
    """Generate a descriptive chart title."""
    x_clean = x_key.replace("_", " ").title()
    y_clean = y_key.replace("_", " ").title()

    if chart_type == "pie":
        return f"{x_clean} Distribution"
    elif chart_type == "line":
        return f"{y_clean} Over {x_clean}"
    elif chart_type == "scatter":
        return f"{x_clean} vs {y_clean}"
    else:
        return f"{y_clean} by {x_clean}"


def _pick_palette(chart_type: str) -> str:
    """Pick a color palette based on chart type."""
    palettes = {
        "bar": "cyan",
        "line": "emerald",
        "pie": "violet",
        "area": "blue",
        "scatter": "amber",
    }
    return palettes.get(chart_type, "cyan")

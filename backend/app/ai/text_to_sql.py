"""Text-to-SQL — Convert natural language questions to SQL queries.

Uses a Hugging Face T5/CodeT5 model for ML-based conversion,
with a rule-based fallback for when the model is unavailable.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.ai.model_loader import is_model_available, load_text_to_sql_model
from app.ai.schema_linker import build_schema_prompt, link_columns

logger = logging.getLogger(__name__)


def generate_sql(
    question: str,
    table_name: str = "dataset",
    columns: list[dict[str, str]] | None = None,
    available_columns: list[str] | None = None,
    prefer_rule_based: bool = False,
) -> dict[str, Any]:
    """
    Convert a natural language question to a SQL query.
    
    Returns dict with:
        - sql: the generated SQL string
        - source: "model" or "rule_based"
        - confidence: estimated confidence (0-1)
    """
    columns = columns or []
    available_columns = available_columns or [c["name"] for c in columns]

    # Try ML model first unless explicitly bypassed.
    if not prefer_rule_based and is_model_available():
        try:
            result = _model_generate_sql(question, table_name, columns)
            if result and result.get("sql"):
                return result
        except Exception as e:
            logger.warning(f"Model SQL generation failed: {e}")

    # Fall back to rule-based
    return _rule_based_sql(question, table_name, available_columns)


def _model_generate_sql(
    question: str,
    table_name: str,
    columns: list[dict[str, str]],
) -> dict[str, Any]:
    """Generate SQL using the loaded Hugging Face model."""
    tokenizer, model = load_text_to_sql_model()
    if tokenizer is None or model is None:
        return {"sql": "", "source": "model", "confidence": 0}

    # Build the prompt that the model expects
    schema_str = build_schema_prompt(table_name, columns)
    prompt = f"tables: {schema_str}. query for: {question}"

    # Tokenize and generate
    import torch

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        max_length=512,
        truncation=True,
        padding=True,
    )

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            num_beams=4,
            early_stopping=True,
            no_repeat_ngram_size=3,
        )

    sql = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()

    # Post-process: clean up the SQL
    sql = _clean_sql(sql, table_name)

    if not sql or not sql.upper().startswith("SELECT"):
        return {"sql": "", "source": "model", "confidence": 0}

    return {
        "sql": sql,
        "source": "model",
        "confidence": 0.8,
    }


def _rule_based_sql(
    question: str,
    table_name: str,
    columns: list[str],
) -> dict[str, Any]:
    """
    Generate SQL using rule-based pattern matching.
    
    Handles common query patterns:
    - count/how many
    - top/highest/most
    - average/mean
    - group by category
    - filter with conditions
    - trends over time
    """
    q = question.lower().strip()
    linked = link_columns(question, columns)

    # Identify numeric and categorical columns
    # (heuristic: columns with number-related names are numeric)
    _numeric_hints = ["amount", "price", "cost", "revenue", "salary", "score",
                      "value", "count", "quantity", "total", "age", "rating",
                      "population", "height", "weight", "income"]

    numeric_cols = [
        c for c in columns
        if any(h in c.lower() for h in _numeric_hints)
    ]
    cat_cols = [c for c in columns if c not in numeric_cols and "id" not in c.lower()]

    # Get the first useful columns as defaults
    default_cat = cat_cols[0] if cat_cols else columns[0] if columns else "*"
    default_num = numeric_cols[0] if numeric_cols else None

    # Referenced columns from the question
    ref_cols = list(linked.values())

    # ── Pattern: Count / How many ─────────────────────────────────
    if re.search(r"\b(how many|count|total number|number of)\b", q):
        group_col = _find_groupby_col(q, ref_cols, cat_cols, default_cat)
        if group_col and group_col != "*":
            sql = (
                f'SELECT "{group_col}", COUNT(*) as count '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY count DESC '
                f'LIMIT 10;'
            )
        else:
            sql = f"SELECT COUNT(*) as total_count FROM {table_name};"
        return {"sql": sql, "source": "rule_based", "confidence": 0.7}

    # ── Pattern: Top / Highest / Most ─────────────────────────────
    if re.search(r"\b(top|highest|most|largest|greatest|best|maximum)\b", q):
        limit = _extract_limit(q, default=5)
        metric_col = _find_metric_col(q, ref_cols, numeric_cols, default_num)
        if metric_col:
            sql = (
                f'SELECT * FROM {table_name} '
                f'ORDER BY "{metric_col}" DESC '
                f'LIMIT {limit};'
            )
        else:
            group_col = _find_groupby_col(q, ref_cols, cat_cols, default_cat)
            sql = (
                f'SELECT "{group_col}", COUNT(*) as count '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY count DESC '
                f'LIMIT {limit};'
            )
        return {"sql": sql, "source": "rule_based", "confidence": 0.6}

    # ── Pattern: Bottom / Lowest / Least ──────────────────────────
    if re.search(r"\b(bottom|lowest|least|smallest|minimum|worst)\b", q):
        limit = _extract_limit(q, default=5)
        metric_col = _find_metric_col(q, ref_cols, numeric_cols, default_num)
        if metric_col:
            sql = (
                f'SELECT * FROM {table_name} '
                f'ORDER BY "{metric_col}" ASC '
                f'LIMIT {limit};'
            )
        else:
            sql = f"SELECT * FROM {table_name} LIMIT {limit};"
        return {"sql": sql, "source": "rule_based", "confidence": 0.6}

    # ── Pattern: Average / Mean ───────────────────────────────────
    if re.search(r"\b(average|avg|mean)\b", q):
        metric_col = _find_metric_col(q, ref_cols, numeric_cols, default_num)
        group_col = _find_groupby_col(q, ref_cols, cat_cols, None)
        if metric_col and group_col:
            sql = (
                f'SELECT "{group_col}", ROUND(AVG("{metric_col}"), 2) as avg_{metric_col.lower().replace(" ", "_")} '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY avg_{metric_col.lower().replace(" ", "_")} DESC '
                f'LIMIT 10;'
            )
        elif metric_col:
            sql = f'SELECT ROUND(AVG("{metric_col}"), 2) as average FROM {table_name};'
        else:
            sql = f"SELECT * FROM {table_name} LIMIT 10;"
        return {"sql": sql, "source": "rule_based", "confidence": 0.6}

    # ── Pattern: Sum / Total ──────────────────────────────────────
    if re.search(r"\b(sum|total|combined)\b", q) and not re.search(r"\btotal number\b", q):
        metric_col = _find_metric_col(q, ref_cols, numeric_cols, default_num)
        group_col = _find_groupby_col(q, ref_cols, cat_cols, None)
        if metric_col and group_col:
            sql = (
                f'SELECT "{group_col}", SUM("{metric_col}") as total_{metric_col.lower().replace(" ", "_")} '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY total_{metric_col.lower().replace(" ", "_")} DESC '
                f'LIMIT 10;'
            )
        elif metric_col:
            sql = f'SELECT SUM("{metric_col}") as total FROM {table_name};'
        else:
            sql = f"SELECT * FROM {table_name} LIMIT 10;"
        return {"sql": sql, "source": "rule_based", "confidence": 0.6}

    # ── Pattern: Distribution / Group By ──────────────────────────
    if re.search(r"\b(distribution|breakdown|group|by each|per|by)\b", q):
        group_col = _find_groupby_col(q, ref_cols, cat_cols, default_cat)
        metric_col = _find_metric_col(q, ref_cols, numeric_cols, default_num)
        if group_col and metric_col:
            sql = (
                f'SELECT "{group_col}", COUNT(*) as count, '
                f'ROUND(AVG("{metric_col}"), 2) as avg_{metric_col.lower().replace(" ", "_")} '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY count DESC '
                f'LIMIT 10;'
            )
        elif group_col:
            sql = (
                f'SELECT "{group_col}", COUNT(*) as count '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY count DESC '
                f'LIMIT 10;'
            )
        else:
            sql = f"SELECT * FROM {table_name} LIMIT 10;"
        return {"sql": sql, "source": "rule_based", "confidence": 0.5}

    # ── Pattern: Comparison (vs / compare) ────────────────────────
    if re.search(r"\b(vs|versus|compare|comparison|difference between)\b", q):
        group_col = _find_groupby_col(q, ref_cols, cat_cols, default_cat)
        metric_col = _find_metric_col(q, ref_cols, numeric_cols, default_num)
        if group_col and metric_col:
            sql = (
                f'SELECT "{group_col}", '
                f'COUNT(*) as count, '
                f'ROUND(AVG("{metric_col}"), 2) as avg_{metric_col.lower().replace(" ", "_")}, '
                f'ROUND(SUM("{metric_col}"), 2) as total_{metric_col.lower().replace(" ", "_")} '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY count DESC;'
            )
        elif group_col:
            sql = (
                f'SELECT "{group_col}", COUNT(*) as count '
                f'FROM {table_name} '
                f'GROUP BY "{group_col}" '
                f'ORDER BY count DESC;'
            )
        else:
            sql = f"SELECT * FROM {table_name} LIMIT 20;"
        return {"sql": sql, "source": "rule_based", "confidence": 0.5}

    # ── Default: Show data ────────────────────────────────────────
    # Try a simple grouped count as default
    if cat_cols:
        sql = (
            f'SELECT "{default_cat}", COUNT(*) as count '
            f'FROM {table_name} '
            f'GROUP BY "{default_cat}" '
            f'ORDER BY count DESC '
            f'LIMIT 10;'
        )
        return {"sql": sql, "source": "rule_based", "confidence": 0.3}

    sql = f"SELECT * FROM {table_name} LIMIT 10;"
    return {"sql": sql, "source": "rule_based", "confidence": 0.3}


# ── Helper Functions ─────────────────────────────────────────────────────────

def _find_groupby_col(
    question: str, ref_cols: list[str], cat_cols: list[str], default: str | None
) -> str | None:
    """Find the best column to GROUP BY."""
    q = question.lower()
    # Check referenced columns first
    for col in ref_cols:
        if col in cat_cols:
            return col
    # Check for keyword mentions
    for col in cat_cols:
        if col.lower().replace("_", " ") in q:
            return col
    return default


def _find_metric_col(
    question: str, ref_cols: list[str], numeric_cols: list[str], default: str | None
) -> str | None:
    """Find the best numeric column for aggregation."""
    q = question.lower()
    for col in ref_cols:
        if col in numeric_cols:
            return col
    for col in numeric_cols:
        if col.lower().replace("_", " ") in q:
            return col
    return default


def _extract_limit(question: str, default: int = 5) -> int:
    """Extract a LIMIT number from the question."""
    match = re.search(r"\b(\d+)\b", question)
    if match:
        num = int(match.group(1))
        if 1 <= num <= 100:
            return num
    return default


def _clean_sql(sql: str, table_name: str) -> str:
    """Clean and validate generated SQL."""
    sql = sql.strip()
    # Remove markdown code fences if present
    sql = re.sub(r"```sql\s*", "", sql)
    sql = re.sub(r"```\s*", "", sql)
    sql = sql.strip()

    # Ensure it ends with semicolon
    if sql and not sql.endswith(";"):
        sql += ";"

    return sql

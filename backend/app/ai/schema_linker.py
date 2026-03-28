"""Schema Linker — Maps natural language terms to actual column names."""

from __future__ import annotations

import re
from difflib import SequenceMatcher


# Common aliases for column name matching
_COMMON_ALIASES: dict[str, list[str]] = {
    "name": ["name", "title", "label", "description"],
    "date": ["date", "time", "timestamp", "created", "updated", "year", "month", "day"],
    "amount": ["amount", "total", "sum", "value", "price", "cost", "revenue", "sales"],
    "count": ["count", "quantity", "number", "num", "qty"],
    "category": ["category", "type", "kind", "class", "group", "genre"],
    "status": ["status", "state", "condition", "active", "enabled"],
    "location": ["country", "city", "state", "region", "location", "address", "place"],
    "person": ["user", "customer", "employee", "student", "player", "author", "name"],
    "id": ["id", "identifier", "code", "key"],
    "rating": ["rating", "score", "grade", "rank", "stars"],
}


def _normalize(text: str) -> str:
    """Normalize text for comparison."""
    return re.sub(r"[^a-z0-9]", " ", text.lower()).strip()


def _similarity(a: str, b: str) -> float:
    """Compute string similarity ratio."""
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


def link_columns(question: str, available_columns: list[str]) -> dict[str, str]:
    """
    Find which actual column names are referenced in the question.
    
    Returns a mapping of {mentioned_term: actual_column_name}.
    Uses fuzzy matching + alias resolution.
    """
    question_lower = _normalize(question)
    linked: dict[str, str] = {}

    for col in available_columns:
        col_normalized = _normalize(col)

        # Direct mention
        if col_normalized in question_lower:
            linked[col_normalized] = col
            continue

        # Check word-by-word (handles "release year" → "release_year")
        col_words = col_normalized.split()
        if len(col_words) > 1 and all(w in question_lower for w in col_words):
            linked[" ".join(col_words)] = col
            continue

        # Alias matching
        for alias_group, aliases in _COMMON_ALIASES.items():
            if any(alias in col_normalized for alias in aliases):
                if any(alias in question_lower for alias in aliases):
                    linked[alias_group] = col
                    break

    return linked


def build_schema_prompt(
    table_name: str,
    columns: list[dict[str, str]],
    question: str = "",
) -> str:
    """
    Build a schema description string for the Text-to-SQL prompt.
    
    Includes column names and sample values to help the model understand
    what data is available.
    """
    col_descriptions = []
    for col_info in columns:
        name = col_info["name"]
        samples = col_info.get("samples", [])
        if samples:
            sample_str = ", ".join(f"'{s}'" for s in samples[:3])
            col_descriptions.append(f"{name} (e.g. {sample_str})")
        else:
            col_descriptions.append(name)

    schema_str = f"{table_name}({', '.join(col_descriptions)})"
    return schema_str


def resolve_column_reference(
    term: str, available_columns: list[str]
) -> str | None:
    """
    Resolve a single term to the best matching column name.
    
    Uses fuzzy string matching with a minimum similarity threshold.
    """
    term_normalized = _normalize(term)

    # Exact match
    for col in available_columns:
        if _normalize(col) == term_normalized:
            return col

    # Fuzzy match
    best_match = None
    best_score = 0.0

    for col in available_columns:
        score = _similarity(term, col)
        if score > best_score and score > 0.6:
            best_score = score
            best_match = col

    # Alias matching as fallback
    if not best_match:
        for col in available_columns:
            col_normalized = _normalize(col)
            for aliases in _COMMON_ALIASES.values():
                if any(a in term_normalized for a in aliases) and any(
                    a in col_normalized for a in aliases
                ):
                    return col

    return best_match

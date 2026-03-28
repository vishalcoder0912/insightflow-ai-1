"""NL Responder — Generate natural language answers from query results.

Uses Ollama for LLM-powered responses when available, otherwise falls back
to template-based responses that are still informative and well-structured.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


async def generate_nl_response(
    question: str,
    sql: str,
    query_result: dict[str, Any],
    dataset_info: dict[str, Any] | None = None,
) -> str:
    """
    Generate a natural language answer from the SQL query results.
    
    Tries Ollama first (if enabled), falls back to template-based response.
    """
    if settings.ollama_enabled:
        try:
            return await _ollama_response(question, sql, query_result, dataset_info)
        except Exception:
            pass  # Fall through to template-based

    return _template_response(question, sql, query_result, dataset_info)


async def _ollama_response(
    question: str,
    sql: str,
    query_result: dict[str, Any],
    dataset_info: dict[str, Any] | None,
) -> str:
    """Generate response using local Ollama LLM."""
    rows = query_result.get("rows", [])
    columns = query_result.get("columns", [])
    row_count = query_result.get("row_count", 0)

    # Build context for the LLM
    result_preview = ""
    if rows and columns:
        header_line = " | ".join(columns)
        data_lines = [" | ".join(str(v) for v in row) for row in rows[:10]]
        result_preview = f"{header_line}\n" + "\n".join(data_lines)

    prompt = f"""You are a data analyst. Answer the user's question based on the SQL query results below.
Be concise, insightful, and use specific numbers from the data. Format your answer in markdown.

Question: {question}
SQL: {sql}
Results ({row_count} rows):
{result_preview}

Answer:"""

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.ollama_base_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 300},
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "").strip()


def _template_response(
    question: str,
    sql: str,
    query_result: dict[str, Any],
    dataset_info: dict[str, Any] | None,
) -> str:
    """Generate a template-based response (no LLM required)."""
    rows = query_result.get("rows", [])
    columns = query_result.get("columns", [])
    row_count = query_result.get("row_count", 0)
    error = query_result.get("error")

    if error:
        return f"I couldn't execute that query: {error}"

    if not rows:
        return "The query returned no results. Try rephrasing your question or checking if the data contains what you're looking for."

    # Single value result
    if row_count == 1 and len(columns) == 1:
        return f"The answer is **{rows[0][0]}**."

    # Single row with multiple columns
    if row_count == 1:
        parts = [f"**{col}**: {val}" for col, val in zip(columns, rows[0])]
        return "Here's what I found:\n\n" + " | ".join(parts)

    # Multiple rows — summarize
    answer_parts = [f"Found **{row_count} results** for your query."]

    # Show top entries
    if row_count <= 5:
        answer_parts.append("\n| " + " | ".join(columns) + " |")
        answer_parts.append("| " + " | ".join("---" for _ in columns) + " |")
        for row in rows:
            answer_parts.append("| " + " | ".join(str(v) for v in row) + " |")
    else:
        # Show summary of first few
        top_label = columns[0] if columns else "entry"
        answer_parts.append(f"\nTop results by **{top_label}**:")
        for row in rows[:5]:
            if len(row) >= 2:
                answer_parts.append(f"- **{row[0]}**: {row[1]}")
            else:
                answer_parts.append(f"- {row[0]}")

        if row_count > 5:
            answer_parts.append(f"\n*...and {row_count - 5} more results.*")

    return "\n".join(answer_parts)

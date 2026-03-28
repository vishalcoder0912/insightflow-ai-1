"""Chat router — AI-powered question answering with Text-to-SQL."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.ai.text_to_sql import generate_sql
from app.models.schemas import ChatChartPayload, ChatRequest, ChatResponse
from app.services.chart_recommender import recommend_chart_for_results
from app.services.metadata_store import metadata_store
from app.services.nl_responder import generate_nl_response
from app.services.sql_executor import sql_executor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handle a chat message — convert question to SQL, execute it,
    and return a structured answer with optional chart.
    """
    question = request.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Check if a dataset is loaded
    schema = sql_executor.get_schema()
    if not schema:
        return ChatResponse(
            answer="No dataset uploaded yet. Please upload a CSV file first, then ask me questions about your data!",
            source="system",
        )

    # Get column info for the Text-to-SQL model
    column_info = sql_executor.get_column_info()
    available_columns = [c["name"] for c in column_info]

    # Step 1: Generate SQL from natural language
    sql_result = generate_sql(
        question=question,
        table_name="dataset",
        columns=column_info,
        available_columns=available_columns,
    )

    sql = sql_result.get("sql", "")
    source = sql_result.get("source", "rule_based")
    confidence = sql_result.get("confidence", 0)

    # Step 2: Execute the SQL query
    query_result = {"columns": [], "rows": [], "row_count": 0, "error": None}
    if sql:
        query_result = sql_executor.execute_query(sql)
        # If model-generated SQL fails (usually bad column refs), retry with rule-based SQL.
        if query_result.get("error"):
            fallback_sql_result = generate_sql(
                question=question,
                table_name="dataset",
                columns=column_info,
                available_columns=available_columns,
                prefer_rule_based=True,
            )
            fallback_sql = fallback_sql_result.get("sql", "")
            if fallback_sql and fallback_sql != sql:
                fallback_query_result = sql_executor.execute_query(fallback_sql)
                if not fallback_query_result.get("error"):
                    sql = fallback_sql
                    source = fallback_sql_result.get("source", "rule_based")
                    confidence = min(confidence, fallback_sql_result.get("confidence", 0.6))
                    query_result = fallback_query_result

    # Step 3: Generate natural language response
    dataset_info = {"schema": schema, "columns": available_columns}
    answer = await generate_nl_response(
        question=question,
        sql=sql,
        query_result=query_result,
        dataset_info=dataset_info,
    )

    # Step 4: Recommend a chart for the results
    chart: ChatChartPayload | None = None
    if query_result.get("rows") and not query_result.get("error"):
        chart = recommend_chart_for_results(
            sql_columns=query_result["columns"],
            sql_rows=query_result["rows"],
            question=question,
        )

    # Step 5: Generate insights
    insights = _extract_insights(query_result, question)

    response = ChatResponse(
        answer=answer,
        sql=sql,
        insights=insights,
        chart=chart,
        source=f"text_to_sql_{source}",
        dataset={"schema": schema, "columns": available_columns},
        meta={
            "confidence": confidence,
            "rows_returned": query_result.get("row_count", 0),
            "sql_source": source,
        },
    )

    try:
        metadata_store.log_chat(
            user_message=question,
            response_text=response.answer,
            sql_text=response.sql,
            source=response.source,
            rows_returned=int(query_result.get("row_count", 0) or 0),
        )
    except Exception as exc:
        logger.warning("Failed to persist chat log: %s", exc)

    return response


def _extract_insights(query_result: dict, question: str) -> list[str]:
    """Extract quick insights from query results."""
    insights = []
    rows = query_result.get("rows", [])
    columns = query_result.get("columns", [])

    if not rows or not columns:
        return insights

    row_count = len(rows)
    insights.append(f"Query returned {row_count} result{'s' if row_count != 1 else ''}.")

    # If there's a numeric column, add some stats
    for col_idx, col_name in enumerate(columns):
        values = []
        for row in rows:
            try:
                values.append(float(row[col_idx]))
            except (ValueError, TypeError, IndexError):
                continue

        if values and len(values) >= 2:
            min_val = min(values)
            max_val = max(values)
            avg_val = sum(values) / len(values)
            spread = max_val - min_val
            insights.append(
                f"**{col_name}** ranges from {min_val:,.2f} to {max_val:,.2f} "
                f"(avg: {avg_val:,.2f}, spread: {spread:,.2f})."
            )
            break  # Just the first numeric column

    return insights[:5]

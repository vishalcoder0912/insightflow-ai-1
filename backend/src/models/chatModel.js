import { query } from "../storage/database.js";

const toChatMessageRecord = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    datasetId: row.dataset_slug,
    message: row.message,
    answer: row.answer ?? "",
    sql: row.sql ?? "",
    insights: Array.isArray(row.insights) ? row.insights : [],
    chart: row.chart ?? null,
    source: row.source ?? "gemini",
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
};

export const saveChatMessage = async (
  datasetSlug,
  message,
  answer,
  sql,
  insights,
  chart,
  source = "gemini",
  client,
) => {
  const result = await query(
    `INSERT INTO chat_messages (
      dataset_slug,
      message,
      answer,
      sql,
      insights,
      chart,
      source
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
    RETURNING
      id,
      dataset_slug,
      message,
      answer,
      sql,
      insights,
      chart,
      source,
      created_at`,
    [
      datasetSlug,
      message,
      answer ?? "",
      sql ?? "",
      JSON.stringify(Array.isArray(insights) ? insights : []),
      chart ? JSON.stringify(chart) : null,
      source,
    ],
    client,
  );

  return toChatMessageRecord(result.rows[0]);
};

export const getChatHistory = async (datasetSlug, client) => {
  const result = await query(
    `SELECT
      id,
      dataset_slug,
      message,
      answer,
      sql,
      insights,
      chart,
      source,
      created_at
     FROM chat_messages
     WHERE dataset_slug = $1
     ORDER BY created_at ASC, id ASC`,
    [datasetSlug],
    client,
  );

  return result.rows.map(toChatMessageRecord);
};

export const deleteChatHistory = async (datasetSlug, client) => {
  const result = await query(
    `DELETE FROM chat_messages
     WHERE dataset_slug = $1`,
    [datasetSlug],
    client,
  );

  return {
    success: true,
    deletedCount: result.rowCount ?? 0,
  };
};

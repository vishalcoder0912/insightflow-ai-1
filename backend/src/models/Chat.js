import { query } from "../storage/database.js";

const toChatRecord = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    datasetId: row.dataset_id,
    message: row.message,
    response: row.response ?? {},
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
    analysis: row.analysis ?? {},
    features: row.features ?? {},
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
};

export const saveChat = async (
  { datasetId, message, response, suggestions, analysis, features },
  client,
) => {
  const result = await query(
    `INSERT INTO chats (
      dataset_id,
      message,
      response,
      suggestions,
      analysis,
      features
    ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
    RETURNING
      id,
      dataset_id,
      message,
      response,
      suggestions,
      analysis,
      features,
      created_at`,
    [
      datasetId,
      message,
      JSON.stringify(response ?? {}),
      JSON.stringify(Array.isArray(suggestions) ? suggestions : []),
      JSON.stringify(analysis ?? {}),
      JSON.stringify(features ?? {}),
    ],
    client,
  );

  return toChatRecord(result.rows[0]);
};

export const getChatsByDatasetId = async (datasetId, client) => {
  const result = await query(
    `SELECT
      id,
      dataset_id,
      message,
      response,
      suggestions,
      analysis,
      features,
      created_at
     FROM chats
     WHERE dataset_id = $1
     ORDER BY created_at ASC, id ASC`,
    [datasetId],
    client,
  );

  return result.rows.map(toChatRecord);
};

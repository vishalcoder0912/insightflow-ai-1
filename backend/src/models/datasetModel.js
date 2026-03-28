import { query } from "../storage/database.js";

const defaultSummary = {
  rowCount: 0,
  columnCount: 0,
  columns: [],
  kpis: [],
  insights: [],
  chartSuggestions: [],
};

const normalizeRowValue = (value) => (value === undefined || value === null ? "" : value);

const normalizeHeaders = (headers) =>
  Array.isArray(headers) ? headers.map((header) => String(header)) : [];

const buildRowsFromRecords = (records, headers) => {
  if (!Array.isArray(records)) return [];

  return records.map((record) =>
    headers.map((header) => normalizeRowValue(record?.[header])),
  );
};

const buildRecordsFromRows = (rows, headers) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, normalizeRowValue(row?.[index])]),
    ),
  );
};

const normalizeDatasetPayload = (data = {}) => {
  const headers = normalizeHeaders(data.headers);
  const rows = Array.isArray(data.rows) ? data.rows : buildRowsFromRecords(data.records, headers);
  const previewRows = Array.isArray(data.previewRows) ? data.previewRows : rows.slice(0, 100);

  return {
    slug: String(data.slug ?? data.id ?? "current"),
    fileName: String(data.fileName ?? ""),
    uploadedAt: data.uploadedAt ? new Date(data.uploadedAt) : new Date(),
    headers,
    rows,
    totalRows: Number(data.totalRows ?? rows.length),
    previewRows,
    summary: data.summary ?? defaultSummary,
  };
};

const toDatasetRecord = (row) => {
  if (!row) return null;

  const headers = normalizeHeaders(row.headers);
  const datasetRows = Array.isArray(row.rows) ? row.rows : [];

  return {
    id: row.slug,
    slug: row.slug,
    fileName: row.file_name,
    uploadedAt:
      row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : String(row.uploaded_at),
    headers,
    rows: datasetRows,
    totalRows: Number(row.total_rows ?? datasetRows.length),
    previewRows: Array.isArray(row.preview_rows) ? row.preview_rows : [],
    records: buildRecordsFromRows(datasetRows, headers),
    summary: row.summary ?? defaultSummary,
  };
};

export const createDataset = async (data, client) => {
  const payload = normalizeDatasetPayload(data);

  const result = await query(
    `INSERT INTO datasets (
      slug,
      file_name,
      uploaded_at,
      headers,
      rows,
      total_rows,
      preview_rows,
      summary
    ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8::jsonb)
    ON CONFLICT (slug) DO UPDATE
    SET
      file_name = EXCLUDED.file_name,
      uploaded_at = EXCLUDED.uploaded_at,
      headers = EXCLUDED.headers,
      rows = EXCLUDED.rows,
      total_rows = EXCLUDED.total_rows,
      preview_rows = EXCLUDED.preview_rows,
      summary = EXCLUDED.summary
    RETURNING
      slug,
      file_name,
      uploaded_at,
      headers,
      rows,
      total_rows,
      preview_rows,
      summary`,
    [
      payload.slug,
      payload.fileName,
      payload.uploadedAt,
      JSON.stringify(payload.headers),
      JSON.stringify(payload.rows),
      payload.totalRows,
      JSON.stringify(payload.previewRows),
      JSON.stringify(payload.summary),
    ],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const getDataset = async (slug, client) => {
  const result = await query(
    `SELECT
      slug,
      file_name,
      uploaded_at,
      headers,
      rows,
      total_rows,
      preview_rows,
      summary
     FROM datasets
     WHERE slug = $1`,
    [slug],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const getCurrentDataset = async (client) => {
  const result = await query(
    `SELECT
      slug,
      file_name,
      uploaded_at,
      headers,
      rows,
      total_rows,
      preview_rows,
      summary
     FROM datasets
     ORDER BY uploaded_at DESC, slug DESC
     LIMIT 1`,
    [],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const deleteDataset = async (slug, client) => {
  const result = await query(
    `DELETE FROM datasets
     WHERE slug = $1
     RETURNING
      slug,
      file_name,
      uploaded_at,
      headers,
      rows,
      total_rows,
      preview_rows,
      summary`,
    [slug],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

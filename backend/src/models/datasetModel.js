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
  const createdAt = data.createdAt ?? data.uploadedAt ?? new Date().toISOString();
  const summary = data.summary ?? data.stats ?? defaultSummary;

  return {
    slug: String(data.slug ?? data.id ?? "current"),
    id: String(data.id ?? data.slug ?? "current"),
    fileName: String(data.fileName ?? data.name ?? ""),
    name: String(data.name ?? data.fileName ?? ""),
    uploadedAt: data.uploadedAt ? new Date(data.uploadedAt) : new Date(createdAt),
    createdAt: new Date(createdAt),
    headers,
    columns: data.columns ?? headers,
    rows,
    data: data.data ?? buildRecordsFromRows(rows, headers),
    totalRows: Number(data.totalRows ?? rows.length),
    previewRows,
    summary,
    stats: data.stats ?? summary,
  };
};

const toDatasetRecord = (row) => {
  if (!row) return null;

  const headers = normalizeHeaders(row.headers ?? row.columns);
  const datasetRows = Array.isArray(row.rows)
    ? row.rows
    : buildRowsFromRecords(Array.isArray(row.data) ? row.data : [], headers);

  return {
    id: row.id ?? row.slug,
    slug: row.slug ?? row.id,
    fileName: row.file_name ?? row.name,
    name: row.name ?? row.file_name,
    uploadedAt:
      row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : String(row.uploaded_at),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? row.uploaded_at),
    headers,
    rows: datasetRows,
    totalRows: Number(row.total_rows ?? datasetRows.length),
    previewRows: Array.isArray(row.preview_rows) ? row.preview_rows : [],
    records: Array.isArray(row.data) ? row.data : buildRecordsFromRows(datasetRows, headers),
    summary: row.summary ?? row.stats ?? defaultSummary,
    stats: row.stats ?? row.summary ?? defaultSummary,
  };
};

export const createDataset = async (data, client) => {
  const payload = normalizeDatasetPayload(data);

  const result = await query(
    `INSERT INTO datasets (
      slug,
      id,
      file_name,
      name,
      uploaded_at,
      created_at,
      headers,
      columns,
      rows,
      data,
      total_rows,
      preview_rows,
      summary,
      stats
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12::jsonb, $13::jsonb, $14::jsonb)
    ON CONFLICT (slug) DO UPDATE
    SET
      id = EXCLUDED.id,
      file_name = EXCLUDED.file_name,
      name = EXCLUDED.name,
      uploaded_at = EXCLUDED.uploaded_at,
      created_at = EXCLUDED.created_at,
      headers = EXCLUDED.headers,
      columns = EXCLUDED.columns,
      rows = EXCLUDED.rows,
      data = EXCLUDED.data,
      total_rows = EXCLUDED.total_rows,
      preview_rows = EXCLUDED.preview_rows,
      summary = EXCLUDED.summary,
      stats = EXCLUDED.stats
    RETURNING
      slug,
      id,
      file_name,
      name,
      uploaded_at,
      created_at,
      headers,
      columns,
      rows,
      data,
      total_rows,
      preview_rows,
      summary,
      stats`,
    [
      payload.slug,
      payload.id,
      payload.fileName,
      payload.name,
      payload.uploadedAt,
      payload.createdAt,
      JSON.stringify(payload.headers),
      JSON.stringify(payload.columns),
      JSON.stringify(payload.rows),
      JSON.stringify(payload.data),
      payload.totalRows,
      JSON.stringify(payload.previewRows),
      JSON.stringify(payload.summary),
      JSON.stringify(payload.stats),
    ],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const getDataset = async (slug, client) => {
  const result = await query(
    `SELECT
      slug,
      id,
      file_name,
      name,
      uploaded_at,
      created_at,
      headers,
      columns,
      rows,
      data,
      total_rows,
      preview_rows,
      summary,
      stats
     FROM datasets
     WHERE slug = $1 OR id = $1`,
    [slug],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const getCurrentDataset = async (client) => {
  const result = await query(
    `SELECT
      slug,
      id,
      file_name,
      name,
      uploaded_at,
      created_at,
      headers,
      columns,
      rows,
      data,
      total_rows,
      preview_rows,
      summary,
      stats
     FROM datasets
     ORDER BY created_at DESC, uploaded_at DESC, slug DESC
     LIMIT 1`,
    [],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const deleteDataset = async (slug, client) => {
  const result = await query(
    `DELETE FROM datasets
     WHERE slug = $1 OR id = $1
     RETURNING
      slug,
      id,
      file_name,
      name,
      uploaded_at,
      created_at,
      headers,
      columns,
      rows,
      data,
      total_rows,
      preview_rows,
      summary,
      stats`,
    [slug],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

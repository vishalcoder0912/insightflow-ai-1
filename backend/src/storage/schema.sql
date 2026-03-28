CREATE TABLE IF NOT EXISTS datasets (
  slug TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  headers JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_rows INTEGER NOT NULL,
  preview_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  dataset_slug TEXT NOT NULL REFERENCES datasets(slug) ON DELETE CASCADE,
  message TEXT NOT NULL,
  answer TEXT,
  sql TEXT,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  chart JSONB,
  source VARCHAR(50) NOT NULL DEFAULT 'gemini',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS datasets_uploaded_at_idx ON datasets (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_dataset_slug_idx ON chat_messages (dataset_slug);
CREATE INDEX IF NOT EXISTS chat_messages_dataset_slug_created_at_idx
  ON chat_messages (dataset_slug, created_at DESC);

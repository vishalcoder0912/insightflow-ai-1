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

ALTER TABLE datasets ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS columns JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE datasets
SET
  id = COALESCE(id, slug),
  name = COALESCE(name, file_name),
  data = COALESCE(data, rows, '[]'::jsonb),
  columns = COALESCE(columns, headers, '[]'::jsonb),
  stats = COALESCE(stats, summary, '{}'::jsonb),
  created_at = COALESCE(created_at, uploaded_at, CURRENT_TIMESTAMP);

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

CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  message TEXT NOT NULL,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS datasets_uploaded_at_idx ON datasets (uploaded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS datasets_id_idx ON datasets (id);
CREATE INDEX IF NOT EXISTS datasets_created_at_idx ON datasets (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_dataset_slug_idx ON chat_messages (dataset_slug);
CREATE INDEX IF NOT EXISTS chat_messages_dataset_slug_created_at_idx
  ON chat_messages (dataset_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS chats_dataset_id_idx ON chats (dataset_id);
CREATE INDEX IF NOT EXISTS chats_dataset_id_created_at_idx ON chats (dataset_id, created_at DESC);

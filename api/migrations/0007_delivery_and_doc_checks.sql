-- 1) New operational status ready_for_authority: SQLite cannot alter a CHECK, so rebuild `requests`.
--    (Run as one transaction; foreign keys are deferred until commit.)
PRAGMA defer_foreign_keys = on;
CREATE TABLE requests_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  service_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','review','needs_documents','ready_for_authority','authority','decision','completed','cancelled','rejected')),
  data TEXT NOT NULL DEFAULT '{}',
  renewal_of TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  staff_data TEXT NOT NULL DEFAULT '{}',
  assignee_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  client_key TEXT,
  client_hash TEXT,
  delivery_version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO requests_new (id,user_id,service_id,status,data,renewal_of,created_at,updated_at,deleted_at,staff_data,assignee_id,version,client_key,client_hash,delivery_version)
  SELECT id,user_id,service_id,status,data,renewal_of,created_at,updated_at,deleted_at,staff_data,assignee_id,version,client_key,client_hash,delivery_version FROM requests;
DROP TABLE requests;
ALTER TABLE requests_new RENAME TO requests;
CREATE INDEX idx_requests_user ON requests(user_id, updated_at);
CREATE UNIQUE INDEX idx_requests_client_key ON requests(user_id, client_key) WHERE client_key IS NOT NULL;

-- 2) Delivery packages: files are saved to a draft package and invisible to the customer until explicitly published.
CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  version INTEGER,
  status TEXT NOT NULL CHECK (status IN ('draft','published','superseded')),
  manifest_hash TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  published_by TEXT,
  published_at INTEGER
);
CREATE UNIQUE INDEX idx_delivery_version ON deliveries(request_id, version) WHERE version IS NOT NULL;
CREATE UNIQUE INDEX idx_delivery_one_draft ON deliveries(request_id) WHERE status = 'draft';
ALTER TABLE request_files ADD COLUMN delivery_id TEXT;
ALTER TABLE request_files ADD COLUMN extracted TEXT;

-- 3) Document rule checks and internal overrides.
CREATE TABLE document_checks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES request_files(id),
  request_id TEXT NOT NULL REFERENCES requests(id),
  rule_code TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('pass','fail','manual_review')),
  evidence TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  superseded_at INTEGER
);
CREATE INDEX idx_checks_file ON document_checks(file_id);
CREATE TABLE document_overrides (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL UNIQUE REFERENCES document_checks(id),
  file_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

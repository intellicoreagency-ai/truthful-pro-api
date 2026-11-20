ALTER TABLE requests ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE requests ADD COLUMN client_key TEXT;
ALTER TABLE requests ADD COLUMN client_hash TEXT;
ALTER TABLE requests ADD COLUMN delivery_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_requests_client_key ON requests(user_id, client_key) WHERE client_key IS NOT NULL;
CREATE TABLE receipt_acks (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  delivery_version INTEGER NOT NULL,
  acknowledged_at INTEGER NOT NULL,
  UNIQUE (request_id, delivery_version)
);

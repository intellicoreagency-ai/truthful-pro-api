ALTER TABLE requests ADD COLUMN staff_data TEXT NOT NULL DEFAULT '{}';
ALTER TABLE requests ADD COLUMN assignee_id TEXT;
ALTER TABLE request_files ADD COLUMN kind TEXT NOT NULL DEFAULT 'source' CHECK (kind IN ('source','final','invoice'));
ALTER TABLE request_files ADD COLUMN label TEXT;
ALTER TABLE wa_challenges ADD COLUMN purpose TEXT NOT NULL DEFAULT 'customer' CHECK (purpose IN ('customer','staff'));
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL UNIQUE,
  phone_enc TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','agent','accountant')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE TABLE staff_sessions (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  access_hash TEXT NOT NULL UNIQUE,
  refresh_hash TEXT NOT NULL UNIQUE,
  prev_refresh_hash TEXT,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE request_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  actor TEXT NOT NULL CHECK (actor IN ('customer','staff','system')),
  staff_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('status','note','missing','file','assign','created')),
  text_ar TEXT NOT NULL,
  text_en TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_request ON request_events(request_id, created_at);
CREATE TABLE missing_documents (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  note_ar TEXT NOT NULL DEFAULT '',
  note_en TEXT NOT NULL DEFAULT '',
  replacement_file_id TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_missing_request ON missing_documents(request_id);

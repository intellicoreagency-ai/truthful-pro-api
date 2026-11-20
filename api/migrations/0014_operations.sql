-- Operations: every status change is logged; follow-up dates; authority submission history; delivery problems; renewal reminders.
CREATE TABLE request_transitions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer','staff','system')),
  actor_id TEXT,
  at INTEGER NOT NULL,
  reason TEXT,
  internal_note TEXT,          -- staff-only; never returned to the customer
  reference TEXT,
  submission_id TEXT,
  attachments TEXT             -- JSON array of file ids the move relied on
);
CREATE INDEX idx_transitions_request ON request_transitions(request_id, at);
CREATE TRIGGER transitions_no_update BEFORE UPDATE ON request_transitions BEGIN SELECT RAISE(ABORT, 'the transition log is append-only'); END;
CREATE TRIGGER transitions_no_delete BEFORE DELETE ON request_transitions BEGIN SELECT RAISE(ABORT, 'the transition log is append-only'); END;

ALTER TABLE requests ADD COLUMN follow_up_at INTEGER;
ALTER TABLE requests ADD COLUMN expires_at INTEGER;       -- approved expiry of the delivered document (drives renewal reminders)

-- Each filing with the authority; a request for more documents returns the active one, a new filing is a new row (history kept).
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  number INTEGER NOT NULL,
  reference TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  submitted_by TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','returned','decided')),
  returned_reason TEXT,
  returned_at INTEGER,
  UNIQUE (request_id, number)
);
ALTER TABLE missing_documents ADD COLUMN submission_id TEXT;

CREATE TABLE delivery_problems (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  delivery_version INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at INTEGER NOT NULL,
  resolved_by TEXT, resolved_at INTEGER, resolution TEXT, resolution_note TEXT
);
CREATE INDEX idx_problems_request ON delivery_problems(request_id, status);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('renewal')),
  due_at INTEGER NOT NULL,
  days_before INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','fired','cancelled')),
  fired_at INTEGER,
  UNIQUE (request_id, kind, days_before)
);
CREATE INDEX idx_reminders_due ON reminders(state, due_at);

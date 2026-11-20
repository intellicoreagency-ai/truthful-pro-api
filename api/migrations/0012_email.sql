-- Customer email (sealed), confirmed by a link in the welcome email; invoices are emailed only to a confirmed address.
ALTER TABLE users ADD COLUMN email_enc TEXT;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN email_token_hash TEXT;
ALTER TABLE users ADD COLUMN email_token_expires INTEGER;

CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('welcome','invoice')),
  ref_id TEXT NOT NULL DEFAULT '',           -- invoice document id for kind=invoice
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE UNIQUE INDEX email_outbox_once ON email_outbox(user_id, kind, ref_id);
CREATE INDEX email_outbox_pending ON email_outbox(status, created_at);

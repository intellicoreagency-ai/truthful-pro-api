-- The Company's own fee per service (set by the owner/manager). When a customer submits a request, the invoice for that fee is issued automatically.
CREATE TABLE service_fees (
  service_id TEXT PRIMARY KEY,
  fee_fils INTEGER NOT NULL CHECK (fee_fils > 0 AND fee_fils <= 100000000),
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The official government fee is looked up on the authority's portal after submission, so it may be set ONCE on an already-issued statement (0 -> amount); it can never be changed afterwards.
DROP TRIGGER quotes_frozen_gov;
CREATE TRIGGER quotes_frozen_gov BEFORE UPDATE ON quotes
  WHEN OLD.status != 'draft' AND NEW.gov_fils != OLD.gov_fils AND OLD.gov_fils != 0
  BEGIN SELECT RAISE(ABORT, 'government fee is already set'); END;

-- Government fees are paid by the customer DIRECTLY to the authority (official link). The company never collects them.
-- quotes.total_fils now means "the company's own fees" (what the customer owes the company); gov_fils is the official
-- tariff shown for transparency only and is not part of any invoice, receipt or balance.
ALTER TABLE quotes ADD COLUMN gov_fils INTEGER NOT NULL DEFAULT 0 CHECK (gov_fils >= 0 AND gov_fils <= 100000000);
ALTER TABLE quotes ADD COLUMN gov_pay_url TEXT;
CREATE TRIGGER quotes_frozen_gov BEFORE UPDATE ON quotes
  WHEN OLD.status != 'draft' AND NEW.gov_fils != OLD.gov_fils
  BEGIN SELECT RAISE(ABORT, 'issued quote is immutable'); END;

-- The customer's own payment to the authority: tracked, never part of the company's balance.
CREATE TABLE authority_payments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  amount_fils INTEGER NOT NULL CHECK (amount_fils > 0 AND amount_fils <= 100000000),
  reference TEXT NOT NULL,
  proof_file_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('reported','verified','rejected')),
  client_key TEXT,
  reported_by_kind TEXT NOT NULL CHECK (reported_by_kind IN ('customer','staff')),
  reported_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  verified_by TEXT,
  verified_at INTEGER,
  note TEXT
);
CREATE INDEX idx_authority_payments_request ON authority_payments(request_id);
CREATE UNIQUE INDEX idx_authority_client_key ON authority_payments(request_id, client_key) WHERE client_key IS NOT NULL;
-- an official receipt/payment number can be registered once (a rejected entry frees it)
CREATE UNIQUE INDEX idx_authority_reference ON authority_payments(reference) WHERE status != 'rejected';
CREATE TRIGGER authority_decided_immutable BEFORE UPDATE ON authority_payments
  WHEN OLD.status != 'reported' AND (NEW.amount_fils != OLD.amount_fils OR NEW.status != OLD.status OR NEW.request_id != OLD.request_id OR NEW.quote_id != OLD.quote_id)
  BEGIN SELECT RAISE(ABORT, 'a decided authority payment cannot be changed'); END;
CREATE TRIGGER authority_no_delete BEFORE DELETE ON authority_payments
  BEGIN SELECT RAISE(ABORT, 'authority payments cannot be deleted'); END;

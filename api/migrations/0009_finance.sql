-- Money is stored as integer fils (1 AED = 100 fils). Currency is AED only. No tax is computed anywhere.
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','issued','accepted','superseded')),
  currency TEXT NOT NULL DEFAULT 'AED' CHECK (currency = 'AED'),
  total_fils INTEGER NOT NULL DEFAULT 0 CHECK (total_fils >= 0 AND total_fils <= 100000000),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  issued_at INTEGER,
  issued_by TEXT,
  accepted_at INTEGER,
  accepted_by TEXT,
  document_id TEXT,
  UNIQUE (request_id, version)
);
CREATE UNIQUE INDEX idx_one_draft_quote ON quotes(request_id) WHERE status = 'draft';
CREATE TABLE quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  kind TEXT NOT NULL CHECK (kind IN ('government_fee','service_fee','extra')),
  description_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  amount_fils INTEGER NOT NULL CHECK (amount_fils >= 0 AND amount_fils <= 100000000),
  position INTEGER NOT NULL
);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
-- An issued quote is frozen: its lines and total can no longer change (a new version needs a new acceptance).
CREATE TRIGGER quote_items_frozen_insert BEFORE INSERT ON quote_items
  WHEN (SELECT status FROM quotes WHERE id = NEW.quote_id) != 'draft'
  BEGIN SELECT RAISE(ABORT, 'issued quote is immutable'); END;
CREATE TRIGGER quote_items_frozen_update BEFORE UPDATE ON quote_items
  WHEN (SELECT status FROM quotes WHERE id = OLD.quote_id) != 'draft'
  BEGIN SELECT RAISE(ABORT, 'issued quote is immutable'); END;
CREATE TRIGGER quote_items_frozen_delete BEFORE DELETE ON quote_items
  WHEN (SELECT status FROM quotes WHERE id = OLD.quote_id) != 'draft'
  BEGIN SELECT RAISE(ABORT, 'issued quote is immutable'); END;
CREATE TRIGGER quotes_frozen_update BEFORE UPDATE ON quotes
  WHEN OLD.status != 'draft' AND (NEW.total_fils != OLD.total_fils OR NEW.version != OLD.version OR NEW.request_id != OLD.request_id)
  BEGIN SELECT RAISE(ABORT, 'issued quote is immutable'); END;
CREATE TRIGGER quotes_no_delete BEFORE DELETE ON quotes
  WHEN OLD.status != 'draft'
  BEGIN SELECT RAISE(ABORT, 'issued quote cannot be deleted'); END;

CREATE TABLE doc_counters (
  doc_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  next INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, year)
);
-- Issued financial documents. `is_test` is forced to 1 by the database: there is deliberately no way to store a live document yet.
CREATE TABLE fin_documents (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('quote','invoice','receipt','credit_note')),
  number TEXT NOT NULL UNIQUE,
  related_id TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','void')),
  void_reason TEXT,
  voided_at INTEGER,
  voided_by TEXT,
  total_fils INTEGER NOT NULL CHECK (total_fils >= 0),
  snapshot TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 1 CHECK (is_test = 1),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_fin_docs_request ON fin_documents(request_id);
CREATE UNIQUE INDEX idx_one_active_invoice ON fin_documents(request_id) WHERE doc_type = 'invoice' AND status = 'issued';
CREATE UNIQUE INDEX idx_one_doc_per_event ON fin_documents(related_id, doc_type) WHERE doc_type IN ('receipt','credit_note');
CREATE TRIGGER fin_documents_no_delete BEFORE DELETE ON fin_documents
  BEGIN SELECT RAISE(ABORT, 'financial documents cannot be deleted'); END;
CREATE TRIGGER fin_documents_immutable BEFORE UPDATE ON fin_documents
  WHEN NEW.number != OLD.number OR NEW.snapshot != OLD.snapshot OR NEW.snapshot_hash != OLD.snapshot_hash OR NEW.total_fils != OLD.total_fils
    OR NEW.doc_type != OLD.doc_type OR NEW.request_id != OLD.request_id OR NEW.related_id IS NOT OLD.related_id OR NEW.created_at != OLD.created_at
    OR OLD.status = 'void'
  BEGIN SELECT RAISE(ABORT, 'financial documents are immutable; cancel or correct with a linked document'); END;

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  invoice_id TEXT NOT NULL REFERENCES fin_documents(id),
  kind TEXT NOT NULL CHECK (kind IN ('payment','refund')),
  amount_fils INTEGER NOT NULL CHECK (amount_fils > 0 AND amount_fils <= 100000000),
  method TEXT NOT NULL CHECK (method IN ('bank_transfer','cash','other')),
  reference TEXT,
  proof_file_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_verification','approved','rejected')),
  client_key TEXT,
  created_by_kind TEXT NOT NULL CHECK (created_by_kind IN ('customer','staff')),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  decided_by TEXT,
  decided_at INTEGER,
  decision_note TEXT,
  receipt_id TEXT,
  refund_of TEXT,
  reason TEXT
);
CREATE INDEX idx_payments_request ON payments(request_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE UNIQUE INDEX idx_pay_client_key ON payments(request_id, client_key) WHERE client_key IS NOT NULL;
-- the same bank transfer / reference cannot be registered twice (a rejected one frees it)
CREATE UNIQUE INDEX idx_pay_reference ON payments(method, reference) WHERE reference IS NOT NULL AND kind = 'payment' AND status != 'rejected';
CREATE TRIGGER payments_decided_immutable BEFORE UPDATE ON payments
  WHEN OLD.status != 'pending_verification' AND (NEW.amount_fils != OLD.amount_fils OR NEW.status != OLD.status OR NEW.kind != OLD.kind OR NEW.request_id != OLD.request_id OR NEW.invoice_id != OLD.invoice_id)
  BEGIN SELECT RAISE(ABORT, 'a decided payment cannot be changed'); END;
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments
  BEGIN SELECT RAISE(ABORT, 'payments cannot be deleted'); END;

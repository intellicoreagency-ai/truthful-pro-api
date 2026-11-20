-- Customer money ledger: payments received (approved) are separate from how they are ALLOCATED to invoices.
-- An invoice's "paid" figure is only ever the sum of its allocations; there is no editable "paid" field anywhere.
CREATE TABLE allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  request_id TEXT NOT NULL REFERENCES requests(id),
  invoice_id TEXT NOT NULL REFERENCES fin_documents(id),
  amount_fils INTEGER NOT NULL CHECK (amount_fils != 0 AND amount_fils BETWEEN -100000000 AND 100000000),
  kind TEXT NOT NULL CHECK (kind IN ('allocate','reverse','refund')),
  reverses_id TEXT REFERENCES allocations(id),
  refund_request_id TEXT,
  reason TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_alloc_payment ON allocations(payment_id);
CREATE INDEX idx_alloc_invoice ON allocations(invoice_id);
CREATE UNIQUE INDEX idx_alloc_one_reversal ON allocations(reverses_id) WHERE reverses_id IS NOT NULL;
CREATE UNIQUE INDEX idx_alloc_one_per_payment_invoice_auto ON allocations(payment_id, invoice_id) WHERE kind='allocate' AND reason='auto';
CREATE TRIGGER alloc_no_update BEFORE UPDATE ON allocations BEGIN SELECT RAISE(ABORT, 'ledger entries cannot be changed; reverse with a new entry'); END;
CREATE TRIGGER alloc_no_delete BEFORE DELETE ON allocations BEGIN SELECT RAISE(ABORT, 'ledger entries cannot be deleted'); END;
-- the same money can never be allocated twice, nor above the invoice, and only approved payments can be allocated
CREATE TRIGGER alloc_checks BEFORE INSERT ON allocations
  WHEN (SELECT status FROM payments WHERE id = NEW.payment_id) != 'approved'
    OR (NEW.amount_fils > 0 AND (SELECT COALESCE(SUM(amount_fils),0) FROM allocations WHERE payment_id = NEW.payment_id) + NEW.amount_fils > (SELECT amount_fils FROM payments WHERE id = NEW.payment_id))
    OR (NEW.amount_fils > 0 AND (SELECT COALESCE(SUM(amount_fils),0) FROM allocations WHERE invoice_id = NEW.invoice_id) + NEW.amount_fils > (SELECT total_fils FROM fin_documents WHERE id = NEW.invoice_id))
    OR (NEW.amount_fils < 0 AND (SELECT COALESCE(SUM(amount_fils),0) FROM allocations WHERE payment_id = NEW.payment_id AND invoice_id = NEW.invoice_id) + NEW.amount_fils < 0)
  BEGIN SELECT RAISE(ABORT, 'allocation exceeds the payment, the invoice or what was allocated'); END;

-- Refund / credit: a REQUEST is not an EXECUTION. Different people/roles approve and execute.
CREATE TABLE refund_requests (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  invoice_id TEXT NOT NULL REFERENCES fin_documents(id),
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount_fils INTEGER NOT NULL CHECK (amount_fils > 0 AND amount_fils <= 100000000),
  resolution TEXT NOT NULL CHECK (resolution IN ('to_customer','to_credit')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','executed')),
  requested_by TEXT NOT NULL, requested_at INTEGER NOT NULL,
  decided_by TEXT, decided_at INTEGER, decision_note TEXT,
  executed_by TEXT, executed_at INTEGER, execution_ref TEXT, credit_note_id TEXT
);
CREATE INDEX idx_refund_req_request ON refund_requests(request_id);
CREATE TRIGGER refund_req_terminal BEFORE UPDATE ON refund_requests
  WHEN OLD.status IN ('rejected','executed') OR NEW.amount_fils != OLD.amount_fils OR NEW.resolution != OLD.resolution OR NEW.payment_id != OLD.payment_id
  BEGIN SELECT RAISE(ABORT, 'a decided refund request cannot be changed'); END;
CREATE TRIGGER refund_req_no_delete BEFORE DELETE ON refund_requests BEGIN SELECT RAISE(ABORT, 'refund requests cannot be deleted'); END;

-- Government fee differences are settled explicitly (never silently turned into Company revenue).
CREATE TABLE gov_adjustments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  delta_fils INTEGER NOT NULL CHECK (delta_fils != 0 AND delta_fils BETWEEN -100000000 AND 100000000),
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TRIGGER gov_adj_no_update BEFORE UPDATE ON gov_adjustments BEGIN SELECT RAISE(ABORT, 'immutable'); END;
CREATE TRIGGER gov_adj_no_delete BEFORE DELETE ON gov_adjustments BEGIN SELECT RAISE(ABORT, 'immutable'); END;
ALTER TABLE quotes ADD COLUMN gov_beneficiary TEXT;

-- Per-service policy: when payment is required, and how much of the Company fee is retained if cancelled before the authority step.
CREATE TABLE service_policies (
  service_id TEXT PRIMARY KEY,
  pay_gate TEXT NOT NULL DEFAULT 'authority' CHECK (pay_gate IN ('none','authority','delivery')),
  retain_pct_before_authority INTEGER NOT NULL DEFAULT 0 CHECK (retain_pct_before_authority BETWEEN 0 AND 100),
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Carry existing (test) approved payments into the ledger.
INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reason,created_by,created_at)
SELECT lower(printf('%s-%s-4%s-a%s-%s',hex(randomblob(4)),hex(randomblob(2)),substr(hex(randomblob(2)),2),substr(hex(randomblob(2)),2),hex(randomblob(6)))),
       id,request_id,invoice_id,amount_fils,'allocate','auto',COALESCE(decided_by,'migration'),COALESCE(decided_at,created_at)
FROM payments WHERE kind='payment' AND status='approved';
INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reason,created_by,created_at)
SELECT lower(printf('%s-%s-4%s-a%s-%s',hex(randomblob(4)),hex(randomblob(2)),substr(hex(randomblob(2)),2),substr(hex(randomblob(2)),2),hex(randomblob(6)))),
       COALESCE(p.refund_of,(SELECT p2.id FROM payments p2 WHERE p2.invoice_id=p.invoice_id AND p2.kind='payment' AND p2.status='approved' ORDER BY p2.created_at LIMIT 1)),
       p.request_id,p.invoice_id,-p.amount_fils,'refund',p.reason,COALESCE(p.decided_by,'migration'),COALESCE(p.decided_at,p.created_at)
FROM payments p WHERE p.kind='refund' AND p.status='approved'
  AND COALESCE(p.refund_of,(SELECT p2.id FROM payments p2 WHERE p2.invoice_id=p.invoice_id AND p2.kind='payment' AND p2.status='approved' ORDER BY p2.created_at LIMIT 1)) IS NOT NULL;

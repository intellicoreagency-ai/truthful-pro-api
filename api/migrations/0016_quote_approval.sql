-- Manual pricing per request, approved by the customer (owner decision, 2026-11-21).
--   staff drafts a quote -> staff sends it (status 'issued', a QUO test document is created)
--   -> the CUSTOMER accepts it (status 'accepted', the invoice is issued from it in the same transaction)
--      or declines it (status 'superseded' + declined_at/decline_reason).
-- Any later price change is a new quote version that the customer must accept again; nothing is invoiced without that acceptance.
ALTER TABLE quotes ADD COLUMN quote_document_id TEXT;   -- the QUO document the customer reviewed (document_id stays the invoice)
ALTER TABLE quotes ADD COLUMN declined_at INTEGER;
ALTER TABLE quotes ADD COLUMN decline_reason TEXT;
-- at most one quote waits for the customer at a time
CREATE UNIQUE INDEX idx_one_pending_quote ON quotes(request_id) WHERE status = 'issued';

-- service_fees is NOT a price list. Its rows are PLACEHOLDER reference amounts (dummy data for testing only, not approved by the owner).
-- They are never invoiced automatically; the dashboard may offer one only as a starting value for a manual quote, clearly labelled.
ALTER TABLE service_fees ADD COLUMN is_placeholder INTEGER NOT NULL DEFAULT 1 CHECK (is_placeholder = 1);

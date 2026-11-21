# Pricing: manual quote per request, approved by the customer

Owner decision, 21 Nov 2026. This replaces the earlier "fixed fee per service, automatic invoice at submission" rule.

## Flow

1. **The customer submits a request.** Nothing is priced or invoiced at this point.
2. **Staff price that request** in the dashboard (Finance card):
   - Company fee lines (`service_fee`) are what the customer owes the Company.
   - Optional official-fee lines (`government_fee`) are information only. The customer pays them to the authority directly.
   - An agent may draft. Only owner, manager or accountant can **send**.
3. **Send.** The quote becomes `issued` and a `T-QUO-…` test document is created.
   - The customer's app shows **"A quotation is waiting for your approval"**, with the lines, the total and the document.
   - Nothing is invoiced yet.
4. **The customer approves the exact version** they were shown (`POST /v1/requests/:id/quotes/:qid/accept` with `{version}`).
   - In one database transaction, the quote becomes `accepted` and the `T-INV-…` invoice is issued from exactly its lines.
   - Retrying returns the same invoice (no duplicate).
   - Another customer gets 404.
   - A stale version is refused with `stale_quote`.
5. **Or the customer declines** (`…/decline`, optional reason). Staff see the reason and can send a new version.
6. **A later price change**, up or down, is a **new version** that the customer must approve again. Until then, the accepted price and its invoice stand.
   - On approval, the old invoice is voided with a credit note.
   - The new invoice is issued.
   - Money already allocated is carried over through reverse and allocate ledger entries. It is never lost or counted twice.
   - Anything above the new total becomes the customer's unallocated credit.
7. **Safeguards on sending and approving.** A quote cannot be sent or approved while:
   - a payment is still waiting for verification, or
   - a refund request is open.

   This keeps the replacement exact.
8. **The official government fee is set once.** After the customer has reported or verified paying the authority, differences go through adjustments, not through a new quote.

## Placeholder fees

The per-service amounts (`service_fees`, Dashboard → "Reference prices (placeholder)") are **dummy test data, not approved prices**:

- They never create an invoice.
- The column `is_placeholder` is forced to `1` by the database.
- The dashboard labels the page as unapproved test data.

The owner's consolidated fee sheet (21 Nov 2026) has **not** been adopted into the app or the server. As that sheet itself states, its open items need the owner's review before anything is loaded:

- 6 items with no fee
- missing fee units
- package scope
- duplicate scopes

## Tests

- `api/test/api.test.ts`:
  - "service fees are placeholders only …"
  - "quotation approval: decline, re-quote, and a later price increase …"
  - "sending creates a quotation, not an invoice …"
  - the updated full-cycle, email and permission tests
- `mobile/scripts/test-sync-map.mts`: the pending quotation is never treated as the accepted price.

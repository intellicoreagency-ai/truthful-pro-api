# Gap analysis: "Claude Code Request Workflow" spec (20 Nov 2026) vs what is built

Legend: **Done** built and tested here · **Partial** works but differs/limited · **Missing** not built · **Decision** needs the owner.
The spec is a proposal, not a description of an existing system; nothing below is claimed beyond what tests show.

| § | Requirement | State | Notes |
|---|---|---|---|
| 1 | Separate customer app + staff interface on one trusted backend | Done | App on Expo, staff web dashboard, shared Cloudflare Worker + D1 + R2. Customers never read other devices. |
| 2.2 | Verified account to submit; browse as guest | Done | Free WhatsApp verification. (Spec: do not claim WhatsApp OTP pre-existed. It did not; it was built here.) |
| 2.4 | "Start" alone creates no draft; explicit save = one stable draft | Done (existing) | Preserved from the audited app. |
| 2.5 | Private storage, server-side verification, resumable uploads without duplicates | Partial | Server checks size + magic bytes, encrypts, stores privately. No upload init/complete, no quarantine step, no dedupe on retried upload. |
| 2.7 | `Idempotency-Key` on submit; same key + different body rejected | **Fixed in this batch** | `clientKey` per request, unique per user; conflict returns 422. |
| 2.8 | Atomic request + event + notification job | Partial | Request + event are separate statements; no outbox yet (Phase 5). |
| 2.9 | Query result before retrying after a timeout | Partial | Idempotency makes the retry safe; UI "confirm by querying first" not added. |
| 3 | Malware scan, quarantine, OCR, ID/licence rules, confidence, manual review | Partial | **Not built: a real malware scanner, quarantine, OCR, confidence scores** (vendor decision, Phase 6). The malware rule exists only as a non-overridable guard with nothing producing results yet. Built: server type/size/signature checks, passport rule, `manual_review` outcome for unreadable input. ID-expiry and licence rules are registered but only manual outcomes can be recorded. |
| 3.43 | Override of document rejection by an authorised member, with reason/evidence | **Done (batch 2)** | `document_checks` + `document_overrides`. Owner/manager accept a failed check after review; rule code, rule **version**, reason (≥10 chars), member and time are stored, an internal note + audit entry are written, the customer never sees it. Wording states it is internal approval, not proof of authenticity or government acceptance. `malware_scan`, `file_signature`, `file_size` are never overridable (tested by breaking the guard). Rules built so far: passport 6 calendar months (staff enters the expiry; month-end/leap-year/boundary tested), plus manual outcomes (e.g. name mismatch). |
| 3.44 | Replacement creates a new document version; history kept | Missing | Replacements are new files; no version chain. |
| 4 | Queue, assignment, opening ≠ changing status, optimistic `version` | **Fixed in this batch** | `version` on requests; staff actions accept `expectedVersion` → 409 on conflict. |
| 4 | No "with authority" without evidence | **Fixed in this batch** | Moving to `authority` requires a submission reference; `rejected` requires a reason. |
| 5 | Status vs stage vs payment vs delivery kept separate | Partial | status, stage and delivery are separate. **`ready_for_authority` added (batch 2)**: required step before `authority`; blocked while a failed document check is unresolved; customer bar stays five stages (it shows Review). Payment state arrives with Phase 3. |
| 5 | Customer cannot set status/stage/money | Done | Tested. |
| 6 | Missing-document request with items; accepted docs untouched; Send disabled until complete; back to review | Done | Item list, staff note shown to customer, answers held until Send, server flips to review. Not yet: document_request version/deadline, concurrent-list conflict. |
| 7 | Quotes, payments, refunds, invoices; minor units; webhook-verified | Missing | Phase 3. Owner decided: no VAT for now (setting, off by default). |
| 8.1–8.4 | Staff delivers final files; customer sees "ready — awaiting acknowledgement" | Done | Tested end to end. |
| 8.6–8.7 | Acknowledgement is a recorded command, once per **published** delivery version | **Done (batch 1+2)** | `receipt_acks` per version; duplicate is a no-op; a newer published version needs its own confirmation and the old one is not carried over; viewing/downloading never acknowledges; staff see each version's confirmation. |
| 8.3 | Explicit publish of a delivery package | **Done (batch 2)** | Uploads go to a DRAFT package (`deliveries`), hidden from the customer in the request, in downloads and in the data export. "Publish to customer" freezes it as version N (manifest hash of file ids + SHA-256), supersedes the previous version, and requires at least one final file. Published packages are immutable. Verified in a browser, including another customer being refused. |
| 8.8 | Report-a-problem ticket linked to the delivery | Missing | The app button exists locally; no server ticket, owner or follow-up deadline. |
| 9 | Archive in the account, short-lived scoped links, minimal sharing | Partial | Files are in R2 and fetched with an authenticated request (no public links). Sharing is the existing app behaviour. Retention policy needs approval. |
| 10 | Dates, scheduler, reminders, renewal, outbox | Missing | Phase 5 (Cloudflare Cron + provider-neutral outbox). Free channels only unless approved. |
| 10 | `renewal_of`, no duplicate active renewals | **Partial → fixed** | A second renewal of the same source returns the existing one. |
| 11 | Data model | Partial | Core tables exist (requests, files, events, missing_documents, staff, consents, audit). Missing: services versions, quotes, payments, deliveries (as packages), document versions, issues, outbox. |
| 12 | API contracts | Partial | Equivalent routes exist under different names. Structured bilingual errors + trace id: missing. |
| 13 | Roles, server-side authorisation, IDOR tests | Done | Owner/manager/agent/accountant; tests change ids across customers and staff scopes. Org/beneficiary authorisation model: Missing. |
| 14 | Acceptance tests | Partial | 1 (idempotent submit), 2 (IDOR), 7 (missing-docs), 8 (version conflicts), 9, 10, 12 covered after this batch. 3, 4, 5, 6, 11, 13 (partly), 15–17: not yet. |
| 15 | Staged delivery (A–E) | Followed | A auth/isolation/schema, B intake/uploads/review/missing: done; C finance/delivery/archive: in progress; D reminders/renewal; E full verification. |

Not claimed: production readiness, real-device behaviour, real WhatsApp/payment/OCR providers.

## Batch log
- **Batch 1** (`3df2574`): idempotent submit, optimistic versions, authority evidence, receipt acknowledgement. 64 API tests.
- **Batch 2** (this commit): `ready_for_authority`, delivery packages with explicit publish and versions, per-version acknowledgement tied to the published package, document checks + internal override, calendar-month passport rule. 73 API tests, 4 app test groups, 20 browser checks (below).
  Browser checks (real Chromium against `wrangler dev`): staff conflict message shown in the dashboard; stale page reloads; failed passport check; blocked from "Ready to submit"; override accepted and displayed; reference prompt for "With authority"; draft delivery hidden from the customer (request, download); other customer refused on download and acknowledgement; publish v1; v1 acknowledged; v2 published and v1 acknowledgement not carried over; v1 ack refused for v2; v2 ack accepted; no page errors.
  Migration `0007` rebuilds `requests` (to widen the status CHECK) and was applied with the real `wrangler d1 migrations apply`; run it in a transaction on any database that already holds data (it defers foreign keys).

## Decisions recorded from the owner (20 Nov 2026)
1. `ready_for_authority` = "Ready to submit", separate from "With authority"; the latter needs the real submission reference; the customer bar stays five stages.
2. Delivery uploads are saved for review only; nothing is visible until "Publish to customer"; acknowledgement belongs to the published package version.
3. Document override: authorised member, after review; records reason, overridden rule, member and date; internal approval only; never bypasses file-safety checks.
4. **Official WhatsApp number +971585144005** is for communication and, in future, request notifications through an authorised integration. **No real messages are sent now.** Opening a `wa.me` link proves nothing: the app treats WhatsApp verification as done only when the signed Meta webhook receives the customer's message. Any future outbound message must be recorded by its provider status, never inferred from opening WhatsApp.
5. Finance (Phase 3) next, with **no VAT in this phase**: the VAT rate stays a setting that is off, documents are "Invoice" not "Tax Invoice", and nothing may zero out VAT that is owed or issue a real tax invoice until the accounting setup is approved.

## Still open after batch 2
Finance (quotes, invoices, payments, refunds), real malware scanning and OCR, report-a-problem tickets, reminders/renewal scheduler and outbox, document version chains, structured bilingual errors, organisation/beneficiary authorisation, real-device testing, production deployment.

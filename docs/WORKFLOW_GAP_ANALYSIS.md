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
| 3 | Malware scan, quarantine, OCR, passport 6-month rule, ID/licence rules, confidence, manual review | Missing | Needs a scanning/OCR vendor decision (Phase 6). Server already rejects wrong types/sizes. |
| 3.43 | Override of document rejection by an authorised member, with reason/evidence | Partial | Status override exists (owner/manager, reason mandatory, audited). Not yet tied to document-rule results (rules don't exist yet). |
| 3.44 | Replacement creates a new document version; history kept | Missing | Replacements are new files; no version chain. |
| 4 | Queue, assignment, opening ≠ changing status, optimistic `version` | **Fixed in this batch** | `version` on requests; staff actions accept `expectedVersion` → 409 on conflict. |
| 4 | No "with authority" without evidence | **Fixed in this batch** | Moving to `authority` requires a submission reference; `rejected` requires a reason. |
| 5 | Status vs stage vs payment vs delivery kept separate | Partial | status+stage separated. Payment/delivery states arrive with Phase 3. Spec names `ready_for_authority`/`with_authority`; built: `authority` (**Decision**: add a separate `ready_for_authority` status?). |
| 5 | Customer cannot set status/stage/money | Done | Tested. |
| 6 | Missing-document request with items; accepted docs untouched; Send disabled until complete; back to review | Done | Item list, staff note shown to customer, answers held until Send, server flips to review. Not yet: document_request version/deadline, concurrent-list conflict. |
| 7 | Quotes, payments, refunds, invoices; minor units; webhook-verified | Missing | Phase 3. Owner decided: no VAT for now (setting, off by default). |
| 8.1–8.4 | Staff delivers final files; customer sees "ready — awaiting acknowledgement" | Done | Tested end to end. |
| 8.6–8.7 | Acknowledgement is a recorded command, once per delivery version | **Fixed in this batch** | `delivery_version` + `receipt_acks`; duplicate is a no-op; new delivery needs a new acknowledgement. View/download never acknowledges. |
| 8.3/8.8 | Explicit publish of a delivery package; report-a-problem ticket | Missing | Upload currently publishes immediately. Issues/tickets not built. |
| 9 | Archive in the account, short-lived scoped links, minimal sharing | Partial | Files are in R2 and fetched with an authenticated request (no public links). Sharing is the existing app behaviour. Retention policy needs approval. |
| 10 | Dates, scheduler, reminders, renewal, outbox | Missing | Phase 5 (Cloudflare Cron + provider-neutral outbox). Free channels only unless approved. |
| 10 | `renewal_of`, no duplicate active renewals | **Partial → fixed** | A second renewal of the same source returns the existing one. |
| 11 | Data model | Partial | Core tables exist (requests, files, events, missing_documents, staff, consents, audit). Missing: services versions, quotes, payments, deliveries (as packages), document versions, issues, outbox. |
| 12 | API contracts | Partial | Equivalent routes exist under different names. Structured bilingual errors + trace id: missing. |
| 13 | Roles, server-side authorisation, IDOR tests | Done | Owner/manager/agent/accountant; tests change ids across customers and staff scopes. Org/beneficiary authorisation model: Missing. |
| 14 | Acceptance tests | Partial | 1 (idempotent submit), 2 (IDOR), 7 (missing-docs), 8 (version conflicts), 9, 10, 12 covered after this batch. 3, 4, 5, 6, 11, 13 (partly), 15–17: not yet. |
| 15 | Staged delivery (A–E) | Followed | A auth/isolation/schema, B intake/uploads/review/missing: done; C finance/delivery/archive: in progress; D reminders/renewal; E full verification. |

Not claimed: production readiness, real-device behaviour, real WhatsApp/payment/OCR providers.

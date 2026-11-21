# Testing

Every test here uses **local test data only**:

- a throw-away database
- a signed **fake** WhatsApp webhook
- the test virus scanner
- no email

Nothing is deployed, no real message is sent and no payment is made.

| Layer | Command | What it covers |
|---|---|---|
| API (server) | `cd api && npx vitest run` | 111 tests. Sign-in, isolation between customers, roles, files (type sniffing, encryption, scanner), workflow, money, **quote → customer approval → invoice**, delivery and receipt, and **network drops** (a retried submit, upload, payment report and approval, or receipt confirmation never duplicates or loses data). |
| Dashboard (unit) | `cd dashboard && npm test` | 18 tests run in jsdom against a fake API. They cover: assignment, permissions by role, missing documents, pricing (draft, send for approval, declined reason), publishing, receipt confirmation, and the board's drag rules. |
| Customer app (unit) | `cd mobile && npm test` | 6 suites: catalogue in 6 languages, services, money arithmetic, server-to-app mapping (incl. pending quotations), and **connection drops while syncing** (the same keys are sent on retry; one request, one copy of each file). |
| Browser (end to end) | `bash scripts/e2e-run.sh` | Each script gets a fresh database and a fresh local API. It builds the dashboard and the app's web preview. |
| Type checks | `npx tsc --noEmit` in `api/` and `mobile/`; `npm run typecheck` in `dashboard/` | |

The browser run executes these scripts:

- `e2e-customer-cycle.cjs`: the full customer ↔ team cycle in the app, including approving the quotation.
- `e2e-finance.cjs`: quotation, approval, payment proof, verification, receipt, government fee and refund (app + dashboard).
- `e2e-workflow.cjs`: edit conflicts, document rules and override, delivery versions, per-version receipt, access between customers.
- `e2e-dashboard.cjs`: WhatsApp sign-in, assign, review, missing document, internal note, viewer.
- `e2e-dashboard-rich.cjs`: overview, dragging a card on the board, drawer, owner override, customers, search.
- `e2e-biometric.cjs`: fingerprint sign-in with a virtual authenticator.

`e2e-wa-code.cjs` additionally needs the mock Meta server (`mock-meta.cjs`), so it is not in the default run.

Browser-run requirements:

- Ports 8788 and 8767 must be free.
- Playwright: `npm i -g playwright`, or `playwright-core` plus a system Chrome via `CHROME_PATH` or `/usr/bin/google-chrome`.

Not covered by any of the above, and still needed before launch:

- tests on a real Android phone and iPhone
- a real WhatsApp (Meta) round trip
- the production virus scanner
- an external penetration test
- a restore drill on the real staging account (see `BACKUP_RESTORE.md`)

Note for the web preview: the sign-in is kept in memory only, by design, so reloading the page signs out. The scripts move through the tab bar instead of reloading.

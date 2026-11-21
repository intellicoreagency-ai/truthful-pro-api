# Progress — Truthful Pro

Branch: `claude/dubai-clearance-app-o1mje9`. Everything is a **test build**: no production deploy, no real messages, no real payments; financial documents are test copies (no tax).

## What is built

### Mobile app (`mobile/`, Expo SDK 58 / React Native, TypeScript, iOS + Android)
Redesign by steps (Apple HIG as the base, native behaviour per platform; rules in `CLAUDE.md` and `.claude/skills/apple-design/SKILL.md`):
- **Step 1 — Navigation:** translucent bottom tab bar (`expo-blur`), five tabs, design tokens (`src/theme.ts`), Android ripple / back button handling (`src/Touch.tsx`).
- **Step 2 — Auth:** Login, Register, finish-account and add-email screens over the Dubai cover with a light frosted-glass card; Cairo (Arabic) + system font (SF Pro on iOS). Passwordless: the user sends a ready-made WhatsApp message, the server verifies Meta's signed webhook. Tokens in `expo-secure-store`. Email is **required** (UI, API and database triggers).
- **Step 3 — Dashboard (My Requests):** glass header, search and filters, Apple-style cards with the server's "what is needed from you" strip, pull-to-refresh, skeleton / empty / no-match / offline states.
- **Step 4 — New Request:** grouped form, bottom-sheet pickers for service and type, validated applicant fields, creates the request with `POST /v1/requests` and confirms only after the server stored it.
- Also present from earlier work: request wizard with document upload, request details, files/share, account, legal screens (draft Terms/Privacy), Arabic/English (RTL), invoices/payments panel.

### API (`api/`, Cloudflare Worker + Hono + D1 + R2)
- **Auth:** customer WhatsApp verification, rotating refresh tokens; staff sign-in by authenticator app (TOTP), passkeys, WhatsApp codes. Roles: owner / manager / agent / accountant.
- **Workflow:** idempotent requests, versioned staff actions, status machine with authority-submission history, document checks with audited override, delivery packages (draft → publish → per-version acknowledgement), delivery problems, delays, renewal reminders, append-only transition log, "what do I do now" for staff and "where am I" for customers.
- **Money (test):** invoice for the Company fee only (automatic at submission when the service has a fee), government fees paid by the customer to the authority and verified (never in our totals), append-only payment ledger with allocations, overpayment credit, refund request / approve / execute, cancellation breakdown, per-service payment policy, daily reconciliation.
- **Safety:** AES-GCM encrypted documents, malware-scan gate (ClamAV bridge in `scanner-service/`, fake scanner for tests only), rate limits, audit log.
- **Email:** welcome + confirmation, then the fee invoice to a confirmed address (Brevo; off until configured). Brevo templates 50 (welcome) and 51 (invoice) created inactive.
- **Tests:** 106 API tests (vitest), 4 mobile test groups, browser flows (Playwright scripts in `scripts/`).

### Staff dashboard (`dashboard/`, React + Vite, installable web)
Overview, request queue/board, request detail (work banner, finance card, delivery, document checks, override), customers, team, security, payments queue, company fees, reconciliation. Arabic/English, strict CSP.

## Tech stack
- **Mobile:** Expo 58, React Native 0.88, TypeScript, `expo-blur`, `expo-secure-store`, `expo-font` (Cairo, IBM Plex Sans Arabic, Plus Jakarta Sans), `react-native-svg`, `StyleSheet` only (no NativeWind).
- **API:** Cloudflare Workers, Hono, D1 (SQLite), R2, `@simplewebauthn/server`, vitest.
- **Dashboard:** React 19, Vite 7, TypeScript.
- **Services:** WhatsApp Cloud API (webhook), Brevo (email), ClamAV (scanner).

## Next steps
1. **Mobile Step 5** (waiting for "Next"), then clean up the remaining screens one by one to the Apple guidelines (tokens, no hard-coded colours).
2. **Test on real devices** (iOS and Android): glass/blur, back button at every depth, ripple, font scale, keyboard; then an EAS build.
3. **Launch gates:** host the real scanner with live signatures and re-test with EICAR; set Meta (App Secret, webhook), Brevo secrets/templates; deploy the Worker with owner-only secrets; lawyer review of Terms/Privacy; accounting setup (tax, company details) before any non-test financial document.
4. **Decisions still open:** separate quotation for approval (currently invoice only); real-time notifications; Brevo automations (needs an extra permission) and the old marketing templates.
5. **Not built yet:** PDF documents, payment gateway, discounts, service questions validated on the server, push/WhatsApp notifications, organisation/beneficiary authorisation.

Details and honest gaps: `docs/WORKFLOW_GAP_ANALYSIS.md`, `docs/PLATFORM_GUIDE.md`, `docs/DEPLOY.md`.

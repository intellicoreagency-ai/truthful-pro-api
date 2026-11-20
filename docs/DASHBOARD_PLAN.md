# TRUTHFUL PRO — Staff Dashboard (company hub): plan

Goal: one place where Truthful Clearance Services LLC receives, processes, delivers and bills customer
transactions, and follows customers up. It sits on the same API/database as the customer app.

## Decisions (my calls; change any of them)
- **Form:** a responsive web app (Arabic RTL + English), installable on phones/desktop. Staff work on desktops and phones; one codebase, no store review.
- **Stack:** React + TypeScript + Vite, served by the same Cloudflare Worker (static assets) with the API under `/staff/v1`. No new vendor.
- **Staff sign-in:** authenticator app (TOTP: free, no WhatsApp/SMS, SIM-swap proof), only for numbers an owner has added; WhatsApp stays as an optional second method. Customers use WhatsApp. Roles:
  `owner` (everything), `manager` (operations, customers, sales, reports), `agent` (assigned requests), `accountant` (finance and invoices).
- **Privacy:** staff see only what their role needs; every view/download of a customer document is written to the audit log.

## Phases (each is built, tested and pushed before the next)
1. **Operations hub** (in progress): staff accounts + roles, request queue and filters, assign to a staff member, status changes with a
   timeline the customer sees, ask for missing documents, internal notes, secure document viewer, upload final/delivery files.
2. **Customer messaging:** in-app thread per request; WhatsApp replies (free within 24 h of the customer's message).
3. **Finance and invoicing:** quotes, UAE VAT 5% tax invoices (FTA required fields), payments log, refunds, outstanding balances, daily cash report.
   Online card payment is a separate decision (needs a UAE payment provider contract).
4. **Customers, sales and marketing:** customer records and history, leads, follow-ups, segments, campaigns (Brevo is already connected for email).
5. **Reminders:** renewal reminders (Emirates ID, residence, licences) with consent. **Business-initiated WhatsApp reminders are paid by Meta**;
   free options are in-app notifications and email.
6. **Document recognition (OCR):** extract names/expiry dates from passports/IDs to pre-fill and to drive renewal reminders. Needs a vendor or model
   decision and a privacy review because the files are highly sensitive.
7. **Reports:** operations KPIs, turnaround time, revenue, staff workload.

## Owner decisions (20 Nov 2026)
- **No VAT at launch.** The company has no TRN yet and sales have not started. The VAT rate is a setting, **off by default**; until a TRN is entered
  documents are issued as plain **"Invoice"**, never "Tax Invoice". (Reminder: UAE VAT registration becomes mandatory above AED 375,000 of taxable supplies
  in 12 months; the setting makes switching on later a configuration change, not a rebuild.)
- **Owner-only team for now.** The owner signs in alone and holds every permission. The role system (manager/agent/accountant) already exists in the API
  and is simply unused until the team grows.

## Not decided yet / needs the owner
- Fee schedule for quotes/invoices.
- Provided (20 Nov 2026): the owner's mobile has calls/SMS only, no WhatsApp, hence authenticator-app sign-in. It is deployed as a secret, not stored in the repo.
- Payment provider (if online payment is wanted).
- OCR provider and where documents may be processed.

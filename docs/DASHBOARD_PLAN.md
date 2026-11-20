# TRUTHFUL PRO — Staff Dashboard (company hub): plan

Goal: one place where Truthful Clearance Services LLC receives, processes, delivers and bills customer
transactions, and follows customers up. It sits on the same API/database as the customer app.

## Decisions (my calls; change any of them)
- **Form:** a responsive web app (Arabic RTL + English), installable on phones/desktop. Staff work on desktops and phones; one codebase, no store review.
- **Stack:** React + TypeScript + Vite, served by the same Cloudflare Worker (static assets) with the API under `/staff/v1`. No new vendor.
- **Staff sign-in:** same free WhatsApp verification as customers, but only for numbers an owner has added as staff. Roles:
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

## Not decided yet / needs the owner
- Who the staff are and their roles (phone numbers).
- Fee schedule and VAT registration number (TRN) for invoices.
- Payment provider (if online payment is wanted).
- OCR provider and where documents may be processed.

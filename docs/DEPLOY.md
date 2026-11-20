# Deploying the API (truthful-pro-api-v2) and building the app

The new API is a separate Worker. It does **not** touch `truthful-pro-api`, `truthful-pro-api-staging`
or their databases/buckets.

## 1. Create resources (once)
```bash
cd api && npm ci
npx wrangler login
npx wrangler d1 create truthful-pro-v2-db          # paste the id into wrangler.toml
npx wrangler r2 bucket create truthful-pro-v2-documents
npx wrangler d1 migrations apply DB --remote
```
## 2. Secrets (never commit)
```bash
npx wrangler secret put PEPPER      # openssl rand -base64 32
npx wrangler secret put DATA_KEY    # openssl rand -base64 32  (back it up offline: losing it makes documents unreadable)
npx wrangler secret put WA_APP_SECRET      # Meta app secret (signs webhooks)
npx wrangler secret put WA_VERIFY_TOKEN    # any random string, also entered in Meta
npx wrangler secret put WA_TOKEN           # optional: free confirmation reply
# set WA_BUSINESS_NUMBER (digits, e.g. 9715XXXXXXXX) and WA_PHONE_NUMBER_ID under [vars] in wrangler.toml
```
Set `ENVIRONMENT = "production"` in `wrangler.toml` for the production deploy.

## 2b. WhatsApp sign-in (free: the customer sends us a message)
Customers are verified when they send a ready-made WhatsApp message to the company number. Inbound messages are free;
the company never sends a paid authentication template. One-time setup:
1. Meta for Developers -> create an app -> add **WhatsApp**. The company number +971585144005 is on the **WhatsApp Business app**, so onboard it
   through Meta's **Embedded Signup with Coexistence** (the number stays active in the Business app AND works with the API). Do not
   register it as a plain Cloud API number: that would disconnect the Business app. Check Meta's current Coexistence requirements
   (app version, keeping the Business app in regular use, which app features are limited) before you start; they change.
2. App settings -> copy the **App Secret** -> `WA_APP_SECRET`.
3. WhatsApp -> Configuration -> Webhook: callback `https://<api-domain>/webhooks/whatsapp`, verify token = `WA_VERIFY_TOKEN`; subscribe to **messages**.
4. Put the number in `WA_BUSINESS_NUMBER`. The optional confirmation reply needs `WA_TOKEN` + `WA_PHONE_NUMBER_ID` and is free inside the 24 h window the customer opens.
Check Meta's current pricing page for your account before launch; free applies to customer-initiated conversations only.
The old SMS route (`/v1/auth/otp/*`, Twilio) is still in the API but the app no longer uses it; it is paid.

## 2c. Staff dashboard (same Worker)
```bash
cd dashboard && npm ci && npm run build        # produces dashboard/dist, served by the API Worker at /
```
### Owner sign-in (authenticator app: free, no WhatsApp or SMS needed)
The owner's number may have no WhatsApp (this one does not), so team members sign in with an **authenticator app**
(Google Authenticator, Microsoft Authenticator, Authy, 1Password...). One-time setup:
```bash
npx wrangler secret put OWNER_PHONE        # the owner's mobile, E.164 (kept out of the repo on purpose)
npx wrangler secret put OWNER_SETUP_KEY    # openssl rand -base64 24   (write it down once; it is only used for enrolment)
```
Then open the dashboard -> **First sign-in** tab -> enter the owner's number and the setup key -> scan the QR with the authenticator app ->
type the first code. After that the owner signs in with *Authenticator app* (number + 6-digit code). Once enrolled, the setup key
can no longer re-enrol anyone, so it is safe to delete the secret afterwards.
Each code works once; guessing is rate-limited; unknown numbers and wrong codes get identical answers.

**Adding team members later:** Team page -> Add member -> the dashboard shows a one-time key (valid 24 h). Give it to them privately; they use
it under *First sign-in* to enrol their own authenticator app. Disabling a member ends their sessions immediately.

**Lost phone / locked-out owner:** there is deliberately no self-service reset. An operator with Cloudflare access runs
`npx wrangler d1 execute DB --remote --command "UPDATE staff SET totp_enabled=0, totp_secret_enc=NULL WHERE role='owner'"`
and re-enrols with the setup key (set `OWNER_SETUP_KEY` again if you deleted it).

### Fingerprint / face sign-in (passkeys)
Works on the **real domain over HTTPS** only. Set the dashboard domain so passkeys are bound to it:
`WEBAUTHN_RP_ID = "ops.<your-domain>"` and `WEBAUTHN_ORIGINS = "https://ops.<your-domain>"` under `[vars]` in `wrangler.toml`.
A passkey is tied to that domain: register again after any domain change, and do not register on `localhost` expecting it to work in production.
After the first sign-in, open **Security -> Enable fingerprint on this device** on each phone/computer you use. Android Chrome and iOS Safari support it.

### WhatsApp login code for staff (optional; **Meta charges per message**)
Besides fingerprint, authenticator app and the free "send us a message" method, the dashboard can send a 6-digit code to a member's WhatsApp.
It appears on the login screen only when configured. It needs the Cloud API (see 2b) and an approved **Authentication** template:
1. WhatsApp Manager -> Message templates -> Create -> category **Authentication**, with the *copy code* button, languages Arabic and English
   (both with the same name, e.g. `truthful_login_code`). Wait for Meta's approval.
2. `npx wrangler secret put WA_TOKEN` (a permanent system-user token) and set `WA_PHONE_NUMBER_ID` and `WA_OTP_TEMPLATE = "truthful_login_code"` under `[vars]`.
These messages are initiated by the company, so Meta bills them (check the current rate for authentication messages in the UAE). Codes last 5 minutes,
work once, are capped at 5 guesses, and unknown numbers get the same answer and no message. A number without WhatsApp (such as the owner's) simply uses
fingerprint or the authenticator app.

WhatsApp sign-in for staff still exists as an optional second method for members who have WhatsApp.
Use a separate custom domain for the dashboard in Cloudflare (e.g. `ops.<your-domain>`) pointing at this Worker.
Local smoke test: start `wrangler dev`, then `node scripts/e2e-dashboard.cjs` (needs `playwright` and the vars in `.dev.vars`).

## 3. Deploy and check
```bash
npx wrangler deploy
curl https://<your-worker>.workers.dev/health
```
Attach a custom domain in the Cloudflare dashboard for production.

## 4. Point the app at it
Build with `EXPO_PUBLIC_API_URL=https://<api-domain>` (HTTPS only; plain HTTP is ignored outside dev builds).
In `mobile/eas.json` add it under each profile's `env`. Then `eas build --profile preview`.

## Known limits
- No staff/admin API yet: statuses beyond `submitted`/`cancelled`, pricing and payments cannot be changed by anyone.
- Cloudflare has no UAE region: data is processed outside the UAE (disclosed in the privacy draft).
- Legal texts in `mobile/src/legal.ts` are drafts and need review by a UAE-licensed lawyer.
- Not yet tested on a real Android/iOS device.

## Live-launch gates (the API enforces the first one)
1. **Malware scanner.** `ENVIRONMENT=production` with no real scanner integrated makes every upload return 503 and `/health` report `ready:false`. The `SCANNER_MODE=fake-test` option is ignored in production. A real engine must be integrated (and tested with EICAR) before launch.
2. **Financial documents.** All documents are TEST copies (`is_test` is forced to 1 by the database). Issuing live documents needs the company's approved details and accounting/tax setup and a deliberate migration; nothing here does it.
3. **No real payment gateway and no real messages** are enabled.
4. Fill `COMPANY_NAME_AR` / `COMPANY_NAME_EN` under `[vars]` only with approved names; licence, address and TRN fields are intentionally not rendered yet.

## Government payment links

Customers pay government fees directly to the authority; staff attach the official payment link to the quote. The API only accepts `https://` links whose host ends in `.gov.ae`. If an authority uses another domain, add it as a comma-separated list in the `GOV_PAY_HOSTS` variable (exact host suffixes, e.g. `pay.example-authority.ae`). Review the list with the owner before launch.

## Real malware scanner (ClamAV)

Workers cannot run ClamAV, so `scanner-service/` holds a small bridge to a ClamAV daemon.

1. On a server you control: `cd scanner-service && SCANNER_TOKEN=<32+ random chars> docker compose up -d` (the `clamav/clamav` image keeps signatures current with freshclam).
2. Put it behind TLS (Cloudflare Tunnel or a reverse proxy).
3. Give the Worker `SCANNER_MODE=clamav-http`, `SCANNER_URL=https://<host>/scan` and `SCANNER_TOKEN` (as secrets).
4. Check `/health` reports `"scanner":"clamav","ready":true`, then test with an EICAR file: it must be refused (422).

Behaviour: only an explicit `clean` releases a file; an outage, timeout or odd answer leaves it `pending` (staff cannot open it) and an owner/manager can `POST /staff/v1/files/:id/rescan` once the scanner is back. In production the Worker accepts only an `https://` scanner URL. Note: a file uploaded while the scanner is down is stored encrypted as pending until rescanned.

## Customer email (welcome + invoice)

Off by default. To enable: set `EMAIL_MODE=brevo`, `BREVO_API_KEY` (secret), `EMAIL_FROM` (a sender verified in Brevo), optionally `EMAIL_FROM_NAME`, `PUBLIC_BASE_URL` (the API origin, used in the confirmation link) and `COMPANY_PAYMENT_NOTE` (bank details shown in the invoice email). Flow: the customer saves their email in the app -> welcome email with a confirmation link -> once confirmed, the invoice for the Company fee is emailed (automatically at submission, or when staff issue it). A 10-minute cron retries failures. Invoices are never sent to an unconfirmed address. `/health` reports `email:true` when configured. Add Brevo to the privacy notice's list of processors and review the template wording with the lawyer.

Brevo templates (created inactive in the owner's account): welcome+confirm = template **50**, company-fee invoice = template **51**. To use them set `EMAIL_TEMPLATE_WELCOME=50` and `EMAIL_TEMPLATE_INVOICE=51` (and activate them in Brevo); the design can then be edited in Brevo without code changes. Without these variables the built-in HTML is sent. Preview each template in Brevo and send a test to yourself before enabling.

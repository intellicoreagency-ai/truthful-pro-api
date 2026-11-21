# Staging: preview both apps and build the APK

Staging is a **separate** Worker (`truthful-pro-api-v2-staging`), with its own database (`truthful-pro-v2-staging-db`) and file store (`truthful-pro-v2-staging-documents`). It cannot touch production or the earlier `truthful-pro-api` Workers.

Nothing below has been run yet. Every command that creates, deploys or uploads something is for the owner to run, on purpose.

## What staging can and cannot do (by configuration)

- **No real WhatsApp messages are sent.** `WA_TOKEN`, `WA_PHONE_NUMBER_ID` and `WA_OTP_TEMPLATE` stay unset, so the server has no way to send one.
- **Tester sign-in without WhatsApp.** Numbers listed in `STAGING_TESTER_PHONES` see a **"Test confirm without WhatsApp"** button.
  - The server offers it only when `ENVIRONMENT` is exactly `staging`.
  - Production refuses it (API test: "staging-only sign-in confirmation").
- **No email.** `EMAIL_MODE` stays unset. Invoices and welcome emails only queue.
- **No payments.** The code has no payment gateway. Payments are reported with proof and verified by staff.
- **Test scanner.** `SCANNER_MODE=fake-test` marks files clean and quarantines the EICAR test string. The production scanner is a launch item.
- **Test documents only.** Every financial document is a "TEST COPY". Tax is not configured.
- **Manual review instead of OCR.** See `DOCUMENT_REVIEW.md`.

## Environment variables for staging (names only: no values are in the code)

### Plain variables

These are already in `api/wrangler.toml` under `[env.staging.vars]`, or added at step 4.

| Name | Value for staging | Required |
|---|---|---|
| `ENVIRONMENT` | `staging` (already set) | yes |
| `OTP_TTL_SECONDS` | `300` (already set) | yes |
| `WA_BUSINESS_NUMBER` | `971585144005` (already set; public number) | yes |
| `SCANNER_MODE` | `fake-test` (already set) | yes |
| `COMPANY_NAME_AR`, `COMPANY_NAME_EN` | already set | yes |
| `PUBLIC_BASE_URL` | the staging Worker URL, e.g. `https://truthful-pro-api-v2-staging.<subdomain>.workers.dev` | yes (step 4) |
| `ALLOWED_ORIGINS` | the customer-app preview URL (Cloudflare Pages), e.g. `https://staging.truthful-pro-app-staging.pages.dev` | yes (step 4) |
| `STAGING_TESTER_PHONES` | comma-separated E.164 numbers of the testers, e.g. `+9715XXXXXXXX,+9715YYYYYYYY` | yes, to sign in without WhatsApp |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` | only if the dashboard moves to a custom domain (default: the Worker host) | optional |
| `GOV_PAY_HOSTS` | extra official payment-link domains, e.g. `.rta.ae` (default: `.gov.ae` only) | optional |
| `COMPANY_PAYMENT_NOTE` | bank details shown to customers (staging: a test note) | optional |

### Secrets

Set each with `npx wrangler secret put <NAME> --env staging`. They are **new values for staging only**: never reuse production keys.

| Name | What | Required |
|---|---|---|
| `PEPPER` | 32 random bytes, base64. Escrow it (see `BACKUP_RESTORE.md`). | yes |
| `DATA_KEY` | 32 random bytes, base64. Encrypts files and personal fields. Escrow it. | yes |
| `OWNER_PHONE` | the owner's E.164 number | yes |
| `OWNER_SETUP_KEY` | 24+ random characters. Used once to enrol the owner's authenticator app; can be removed afterwards. | yes (first sign-in) |
| `WA_APP_SECRET`, `WA_VERIFY_TOKEN` | only to test the **real** inbound WhatsApp webhook. Receiving only; nothing is sent. | optional |

### Must stay unset in staging

These would allow outbound messages, email or code echoes:

- `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_OTP_TEMPLATE`
- `EMAIL_MODE`, `BREVO_API_KEY`, `EMAIL_FROM`
- `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`
- `DEV_OTP_ECHO`, `SCANNER_URL`, `SCANNER_TOKEN`

### Expo (APK build)

| Name | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | EAS environment **preview** (plaintext; it is a public URL) | the staging Worker URL (https) |

## Steps (owner, in order)

1. **Access.** You need the Cloudflare account (Workers Paid, so database history is kept 30 days) and the Expo account that owns project `3a7d3dbd-a174-4dd6-9f2c-6363e7abbe49`.
2. **Create the storage (once).**
   ```
   cd api
   npx wrangler d1 create truthful-pro-v2-staging-db
   npx wrangler r2 bucket create truthful-pro-v2-staging-documents
   ```
   Paste the printed `database_id` into `[[env.staging.d1_databases]]`.
3. **Set the secrets** (table above). Create the schema:
   ```
   npx wrangler d1 migrations apply truthful-pro-v2-staging-db --remote --env staging
   ```
4. **Build and publish the previews.**
   1. Build: `bash scripts/build-staging-previews.sh https://truthful-pro-api-v2-staging.<subdomain>.workers.dev`. It builds the dashboard and the customer-app web preview, and only prints the deploy commands.
   2. Deploy the Worker: `npx wrangler deploy --env staging`.
   3. Deploy the web preview: `npx wrangler pages deploy ../mobile/dist-web --project-name truthful-pro-app-staging --branch staging`.
   4. Set `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS` and `STAGING_TESTER_PHONES` under `[env.staging.vars]`, then deploy the Worker once more.
5. **Owner's first sign-in to the dashboard.**
   1. Open the staging Worker URL, choose **أول دخول (first sign-in)**, and enter `OWNER_PHONE` and `OWNER_SETUP_KEY`.
   2. Scan the QR code with an authenticator app.
   3. Add staff from **الفريق (Team)**. Each receives a one-time enrolment key; no message is sent.
6. **APK.**
   ```
   cd mobile
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://truthful-pro-api-v2-staging.<subdomain>.workers.dev --visibility plaintext
   npx eas-cli build --profile staging --platform android
   ```
   EAS keeps the signing key. The build page gives the APK link to install on test phones. The `staging` profile builds an installable APK, internal distribution only.
7. **Restore drill on staging.** Run `BACKUP_RESTORE.md` steps 1–6 against `--remote` staging resources, into a separate database. Record the result.
8. **Smoke test on real phones (Android and iPhone).**
   - Sign in with a tester number and the test button.
   - Create a request with two documents.
   - Staff ask for a document; the customer answers.
   - Staff send a quotation; the customer approves it; the invoice appears.
   - Report a payment with proof; staff verify it.
   - Publish a delivery; the customer confirms receipt.
   - Repeat with flight mode on during upload and submit: nothing is lost or duplicated.
   - Try the Android back button on every screen.

## After staging, before launch (not covered here)

- Real WhatsApp (Meta) set-up and a real round trip.
- The production virus scanner.
- Email sender and templates.
- Lawyer-approved terms and privacy texts.
- Approved prices (owner's fee sheet) and tax set-up.
- A penetration test.
- Production keys in escrow.
- Store listings.

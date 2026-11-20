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

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
1. Meta for Developers -> create an app -> add **WhatsApp**; register the company's business number (it cannot be in use on a normal WhatsApp account).
2. App settings -> copy the **App Secret** -> `WA_APP_SECRET`.
3. WhatsApp -> Configuration -> Webhook: callback `https://<api-domain>/webhooks/whatsapp`, verify token = `WA_VERIFY_TOKEN`; subscribe to **messages**.
4. Put the number in `WA_BUSINESS_NUMBER`. The optional confirmation reply needs `WA_TOKEN` + `WA_PHONE_NUMBER_ID` and is free inside the 24 h window the customer opens.
Check Meta's current pricing page for your account before launch; free applies to customer-initiated conversations only.
The old SMS route (`/v1/auth/otp/*`, Twilio) is still in the API but the app no longer uses it; it is paid.

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

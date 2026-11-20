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
npx wrangler secret put TWILIO_SID
npx wrangler secret put TWILIO_TOKEN
npx wrangler secret put TWILIO_FROM
```
In `production` the API refuses to send OTP without an SMS provider and never returns the code.
Set `ENVIRONMENT = "production"` in `wrangler.toml` for the production deploy.

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

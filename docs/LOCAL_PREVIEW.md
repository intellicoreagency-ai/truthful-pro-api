# Preview the team dashboard locally (or in a GitHub Codespace)

The dashboard (`dashboard/`, React + Vite) talks to the API (`api/`, Cloudflare Worker). Locally you run both:
the API on port **8788** and the dashboard on port **5173**. Open **5173** in the browser.

## 1. First time only

```bash
cd api
npm install
cat > .dev.vars <<EOF
OWNER_PHONE=+971501234567
WA_APP_SECRET=local-dev-secret
PEPPER=$(openssl rand -base64 32)
DATA_KEY=$(openssl rand -base64 32)
EOF
npx wrangler d1 migrations apply DB --local
cd ../dashboard
npm install
npm run build          # the Worker expects dashboard/dist to exist
```

`.dev.vars` is git-ignored and only used on your machine. `OWNER_PHONE` is the number you sign in with.

## 2. Every time (two terminals)

Terminal 1, the API:

```bash
cd api && npx wrangler dev --port 8788
```

Terminal 2, the dashboard with live reload:

```bash
cd dashboard && npm run dev
```

In a Codespace, open the **Ports** tab and click the globe icon next to **5173**.
On your own computer, open http://localhost:5173.

## 3. Sample data (optional, once)

With the API running, in a third terminal:

```bash
node scripts/dev-seed.cjs
```

## 4. Signing in locally

There is no real WhatsApp locally, so you play the part of sending the message:

1. On the sign-in screen choose **WhatsApp**, enter `0501234567` and press **Verify with WhatsApp**.
2. The screen shows a code such as `TP-X82LG2VQ`. In a terminal run:
   `node scripts/dev-wa.cjs TP-X82LG2VQ`
3. The dashboard signs you in a few seconds later.

Sign-in is limited to 5 attempts per 10 minutes per number, as in production.

## Notes

- Uploaded files stay "waiting for scan" locally (no scanner), so moving a request to *Ready to submit* is blocked
  until you mark them clean: `cd api && npx wrangler d1 execute DB --local --command "UPDATE request_files SET scan_status='clean'"`.
- Prefer one port? After `npm run build` in `dashboard/`, the Worker on **8788** also serves the built dashboard
  (no live reload).

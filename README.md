# TRUTHFUL PRO API v0.1
Cloudflare Worker with private D1 and R2 bindings.

## Endpoints
- GET /health: verifies D1 query and R2 binding existence
- GET /v1/services: public, active verified services only, audience=individual|company optional
- Other routes: 404; unsafe methods: 405

No authentication, customer request, or file-upload endpoints exist in this bootstrap release. Do not use real customer data until authorization, encryption, retention and privacy obligations are implemented.

## Deploy
Use the existing Cloudflare Worker truthful-pro-api. Configure Workers Builds to deploy this repository with command `npx wrangler deploy`. Do not create a new Worker, D1 database, or R2 bucket.

## Next.js marketing site and docs
This repository also contains the Truthful Pro marketing site, docs and a mock verification endpoint, built with Next.js (`src/`, `package.json`). It is separate from the Cloudflare Worker above (`worker.js`, `wrangler.jsonc`).

- `npm install && npm run dev` runs the site locally.
- `/` is the landing page, `/docs` the API docs, `POST /api/verify` the mock endpoint (returns `"mock": true`).
- Design context: `PRODUCT.md` and `DESIGN.md`.

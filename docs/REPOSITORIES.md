# Repositories: what lives where (read-only check, 20 Nov 2026)

Nothing has been moved, merged or pushed anywhere except the branch below. Decide before any merge.

| Repository | What it contains (as read from GitHub) | Touched by this work? |
|---|---|---|
| `mrkmallah-cmd/truthful-pro-api` | The owner's original repo: `main` (commit `821c803`, "trigger initial Cloudflare deployment": `worker.js`, `wrangler.jsonc`, `README.md`, `BUILD_TRIGGER.md`), `staging-v1`, `feature/truthful-pro-expo-dubai-v1`, `feature/truthful-pro-dubai-elegance-v1`, `feature/truthful-pro-flutter-ui-phase1`, `review/expo-mobile-service-design`. | **No.** Only listed branches and read the top level of `main`. |
| `intellicoreagency-ai/truthful-pro-api` | A near-empty repo (an initial `ccr-…` branch with only `.claude/settings.json`). **All code from this session is here**, on `claude/dubai-clearance-app-o1mje9`: `mobile/` (Expo app), `api/` (Cloudflare Worker `truthful-pro-api-v2`), `dashboard/` (staff web app), `docs/`, `scripts/`. | Yes: the only place anything was pushed. |

Why this happened: the session was attached to both repositories; the working checkout was the `intellicoreagency-ai` one, so every push went there.

Cautions
- `mrkmallah-cmd/truthful-pro-api` `main` looks wired to a Cloudflare deployment ("trigger initial Cloudflare deployment"). **Do not merge or push into `main` without a deliberate decision**: it may deploy.
- The Cloudflare account already has a Worker named `truthful-pro-api` (and `-staging`). This work uses a different name (`truthful-pro-api-v2`) so it cannot overwrite them.
- Options (owner's call, none done): (a) keep this repo as the home of the new code; (b) open a PR from this branch into `mrkmallah-cmd/truthful-pro-api` (e.g. into a new branch, not `main`); (c) mirror the branch there. I recommend (b) targeting a new integration branch, reviewed before anything touches `main` or `staging-v1`.

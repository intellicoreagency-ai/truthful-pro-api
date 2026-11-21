# Repositories: single source of truth

Updated 22 Nov 2026. Nothing has been merged, mirrored or pushed between the two repositories. Nothing will be, except by a deliberate decision of the owner.

## Decision

**The single source of truth for the Truthful Pro platform is `intellicoreagency-ai/truthful-pro-api`.** The platform is:

- `mobile/`: the customer app
- `api/`: the Worker `truthful-pro-api-v2`
- `dashboard/`: the staff web app
- `docs/` and `scripts/`

Within that repository, the **current line of work is branch `claude/glass-step5-transaction-details`**. All work from 20–22 Nov 2026 is on that branch, including the quotation approval and the test suites.

| Repository / branch | Role | Rule |
|---|---|---|
| `intellicoreagency-ai/truthful-pro-api` @ `claude/glass-step5-transaction-details` | **Source of truth.** Latest code, tests and docs. | All new work starts from here. Staging and the APK build from here. |
| `intellicoreagency-ai/truthful-pro-api` @ `claude/dubai-clearance-app-o1mje9` | Older branch (`c875509`). It is an ancestor of the current one, so nothing on it is missing from the current branch. | Stale. Do not build from it. It can be deleted once the owner agrees. |
| `intellicoreagency-ai/truthful-pro-api` @ `ccr-…` branches | Session scaffolding (`.claude/settings.json` only). | Ignore. |
| `mrkmallah-cmd/truthful-pro-api` (all branches) | The owner's **earlier** project: `main` has `worker.js` / `wrangler.jsonc` ("trigger initial Cloudflare deployment"), plus `staging-v1` and earlier Expo/Flutter experiments. As listed on 20 Nov 2026. | **Legacy, read-only reference.** No pushes, merges or mirrors from this work. |

## Why there are two repositories

The earlier session was attached to both repositories. The working copy was the `intellicoreagency-ai` one, so every push went there.

This session cannot read `mrkmallah-cmd/truthful-pro-api`: two repositories with the same name cannot be attached to one session. Its state above is therefore **as checked on 20 Nov 2026**. Re-check it before any decision that depends on it.

## Cautions

- `mrkmallah-cmd/truthful-pro-api` `main` looks wired to a Cloudflare deployment. Pushing to it may deploy the **old** worker.
- The Cloudflare account already has Workers named `truthful-pro-api` and `truthful-pro-api-staging` from the earlier project. This platform deliberately uses different names, so it cannot overwrite them:
  - `truthful-pro-api-v2`
  - `truthful-pro-api-v2-staging` (see `STAGING.md`)

## If the owner later wants one repository only (owner's call; none of this is done)

1. Make sure the earlier repository has nothing worth keeping that this one lacks: compare its `worker.js` routes and Cloudflare settings with `api/`.
2. Then choose one:
   - **(a)** Archive `mrkmallah-cmd/truthful-pro-api` (read-only on GitHub) and keep this repository.
   - **(b)** Open a pull request from this branch into a **new** branch there (never `main` or `staging-v1`), review it, and only then decide about `main`.
3. Before either, protect the chosen default branch: reviews required, no force-push.

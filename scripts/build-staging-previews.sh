#!/usr/bin/env bash
# Builds the two STAGING previews from this checkout. It does NOT deploy anything; it prints the deploy commands to run on purpose.
#   bash scripts/build-staging-previews.sh https://truthful-pro-api-v2-staging.<account-subdomain>.workers.dev
#   1. staff dashboard  -> dashboard/dist      (served by the staging Worker itself at the same URL)
#   2. customer app web -> mobile/dist-web     (static site; deploy to Cloudflare Pages project "truthful-pro-app-staging")
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${1:-}"
[[ "$API" =~ ^https://[a-z0-9.-]+$ ]] || { echo "usage: $0 https://<staging-worker-host>  (https, no trailing slash)"; exit 2; }
case "$API" in *truthful-pro-api-v2-staging*) ;; *) echo "refusing: $API is not the staging Worker (expected truthful-pro-api-v2-staging…)"; exit 2;; esac
echo "== dashboard (same origin as the API)"; ( cd "$ROOT/dashboard" && npm run build )
echo "== customer app web preview -> $API"; rm -rf "$ROOT/mobile/dist-web"
( cd "$ROOT/mobile" && EXPO_PUBLIC_API_URL="$API" npx expo export -p web --output-dir dist-web )
cat <<NEXT

Built. Nothing was deployed. When you decide to publish staging:
  cd api && npx wrangler deploy --env staging                      # API + dashboard  -> $API
  npx wrangler pages deploy ../mobile/dist-web --project-name truthful-pro-app-staging --branch staging
Then add the Pages URL to ALLOWED_ORIGINS of the staging Worker (docs/STAGING.md, step 4).
NEXT

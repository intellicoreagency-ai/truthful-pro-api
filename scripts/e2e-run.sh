#!/usr/bin/env bash
# Local browser acceptance run. LOCAL TEST DATA ONLY: a fresh throw-away database, a signed FAKE WhatsApp webhook,
# the test virus scanner and no email. Nothing is deployed, no real message is sent and no payment is made.
#
#   bash scripts/e2e-run.sh                      # all browser scripts
#   bash scripts/e2e-run.sh e2e-finance.cjs      # just one
#
# Needs: Node 20+, the repo's npm dependencies (api/, dashboard/, mobile/), Playwright (npm i -g playwright, or playwright-core
# + a system Chrome at /usr/bin/google-chrome or CHROME_PATH). Uses ports 8788 (API + dashboard) and 8767 (customer app preview).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${E2E_WORK:-$(mktemp -d /tmp/truthful-e2e.XXXXXX)}"
STATE="$WORK/state"; LOG="$WORK/logs"; mkdir -p "$STATE" "$LOG"
SCRIPTS=("$@"); [ ${#SCRIPTS[@]} -eq 0 ] && SCRIPTS=(e2e-customer-cycle.cjs e2e-finance.cjs e2e-workflow.cjs e2e-dashboard.cjs e2e-dashboard-rich.cjs e2e-biometric.cjs)
rnd() { node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"; }

# wrangler starts child processes (workerd): stop them by their command line, and only the ones this script started (port 8788).
stop_api() { pkill -f "wrangler dev --port 8788" 2>/dev/null || true; pkill -f "workerd.*8788" 2>/dev/null || true; for i in $(seq 1 20); do curl -sf http://localhost:8788/health >/dev/null || return 0; sleep 0.5; done; }
cleanup() { stop_api; [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "== work dir: $WORK"
echo "== dashboard build (served by the API worker)"
( cd "$ROOT/dashboard" && npm run build > "$LOG/dashboard-build.log" 2>&1 )

# Every script gets a FRESH database and a fresh API process (they enrol the owner and assume an empty system).
start_api() {
  stop_api
  rm -rf "$STATE"; mkdir -p "$STATE"
  ( cd "$ROOT/api" && npx wrangler d1 migrations apply DB --local --persist-to "$STATE" > "$LOG/migrate.log" 2>&1 )
  ( cd "$ROOT/api" && exec npx wrangler dev --port 8788 --persist-to "$STATE" \
      --var ENVIRONMENT:development --var OWNER_PHONE:+971501234567 --var OWNER_SETUP_KEY:local-owner-setup-key-12345 \
      --var WA_APP_SECRET:e2e-secret --var SCANNER_MODE:fake-test --var ALLOWED_ORIGINS:http://localhost:8767 \
      --var PEPPER:"$PEPPER" --var DATA_KEY:"$DATA_KEY" > "$LOG/api.log" 2>&1 ) & API_PID=$!
  for i in $(seq 1 60); do curl -sf http://localhost:8788/health >/dev/null && return 0; sleep 1; done
  echo "API did not start; see $LOG/api.log"; exit 1
}
PEPPER="$(rnd)"; DATA_KEY="$(rnd)"

echo "== 4/4 customer app web preview (:8767, pointed at the local API)"
( cd "$ROOT/mobile" && EXPO_PUBLIC_API_URL=http://localhost:8788 npx expo export -p web --dev --output-dir "$WORK/web" > "$LOG/app-build.log" 2>&1 )
( cd "$WORK/web" && python3 -m http.server 8767 > "$LOG/web.log" 2>&1 ) & WEB_PID=$!
sleep 2

# fixtures the scripts upload
printf '%%PDF-1.4\n1 0 obj<<>>endobj\n%%%%EOF\n' > "$WORK/doc.pdf"
node -e "require('fs').writeFileSync('$WORK/photo.jpg',Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64'))"

FAILED=0
for s in "${SCRIPTS[@]}"; do
  echo; echo "########## $s"; start_api
  ( cd "$WORK" && node "$ROOT/scripts/$s" ) 2>&1 | tee "$LOG/$s.log" || true
  if grep -qE '^FAIL' "$LOG/$s.log"; then echo "=> $s: FAILED"; FAILED=1; else echo "=> $s: passed"; fi
done
echo; [ $FAILED -eq 0 ] && echo "ALL BROWSER SCRIPTS PASSED" || echo "SOME BROWSER SCRIPTS FAILED (logs: $LOG)"
exit $FAILED

#!/usr/bin/env bash
# Backup → restore drill into a SEPARATE database and file store. LOCAL TEST DATA ONLY (nothing remote is read or written).
# It runs the same commands as the production procedure in docs/BACKUP_RESTORE.md, with --local instead of --remote:
#   1. a "primary" copy is filled with a realistic case (customer, request, 4 encrypted files, team with roles, a deactivated
#      member, quote → invoice, payment, delivery, receipt);
#   2. backup: `wrangler d1 export` (schema + data) and every R2 object (already encrypted) copied out by key;
#   3. restore into a brand-new "restore" copy: `wrangler d1 execute --file`, then every object put back;
#   4. the restored copy is started with the escrowed keys and checked (sign-in, roles, files byte-for-byte, money, documents,
#      customer sign-in, ledger rules) — and once more with a WRONG DATA_KEY to prove the keys are part of the backup.
#   bash scripts/backup-restore-drill.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="${DRILL_WORK:-$(mktemp -d /tmp/truthful-drill.XXXXXX)}"; mkdir -p "$W/backup/r2" "$W/logs"
BUCKET=truthful-pro-v2-documents
echo "== drill folder: $W"

mkcopy() { # an isolated copy of the API project with its own .wrangler/state (local D1 + R2)
  mkdir -p "$1"; cp -r "$ROOT/api/src" "$ROOT/api/migrations" "$ROOT/api/wrangler.toml" "$ROOT/api/package.json" "$1/"; ln -s "$ROOT/api/node_modules" "$1/node_modules"
  # the worker also serves the dashboard from ../dashboard/dist (not needed for the drill: an empty folder is enough)
  mkdir -p "$W/dashboard/dist"
}
keys() { printf 'PEPPER=%s\nDATA_KEY=%s\nWA_APP_SECRET=e2e-secret\nOWNER_PHONE=+971501234567\nOWNER_SETUP_KEY=local-owner-setup-key-12345\nSCANNER_MODE=fake-test\nENVIRONMENT=development\n' "$1" "$2" > "$3/.dev.vars"; }
serve() { ( cd "$1" && exec npx wrangler dev --port "$2" > "$W/logs/$3.log" 2>&1 ) & for i in $(seq 1 60); do curl -sf "http://localhost:$2/health" >/dev/null && return 0; sleep 1; done; echo "server $3 did not start"; exit 1; }
stop() { pkill -f "wrangler dev --port $1" 2>/dev/null || true; for i in $(seq 1 20); do curl -sf "http://localhost:$1/health" >/dev/null || return 0; sleep 0.5; done; }
trap 'stop 8790; stop 8791' EXIT

# The two secrets live ONLY in the escrow (password manager) in production; here we generate them once and "escrow" them in a file.
PEPPER="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
DATA_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
printf 'PEPPER=%s\nDATA_KEY=%s\n' "$PEPPER" "$DATA_KEY" > "$W/backup/escrowed-keys.txt"; chmod 600 "$W/backup/escrowed-keys.txt"

echo "== 1/4 primary: migrations + realistic data"
mkcopy "$W/primary"; keys "$PEPPER" "$DATA_KEY" "$W/primary"
( cd "$W/primary" && npx wrangler d1 migrations apply DB --local > "$W/logs/migrate.log" 2>&1 )
serve "$W/primary" 8790 primary
node "$ROOT/scripts/backup-drill.cjs" seed 8790 "$W/expected.json"
stop 8790

echo "== 2/4 backup: database export + every stored file (ciphertext)"
( cd "$W/primary" && npx wrangler d1 export DB --local --output "$W/backup/db.sql" > "$W/logs/export.log" 2>&1 )
KEYS="$( cd "$W/primary" && npx wrangler d1 execute DB --local --json --command "SELECT r2_key FROM request_files WHERE r2_key!='deleted'" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s)[0].results.map(r=>r.r2_key).join('\n'))})" )"
N=0; while read -r k; do [ -z "$k" ] && continue; mkdir -p "$W/backup/r2/$(dirname "$k")"
  ( cd "$W/primary" && npx wrangler r2 object get "$BUCKET/$k" --local --file "$W/backup/r2/$k" > /dev/null 2>&1 ); N=$((N+1)); done <<< "$KEYS"
echo "   database: $(wc -c < "$W/backup/db.sql") bytes, $(grep -c '^INSERT' "$W/backup/db.sql") rows; files: $N objects"

echo "== 3/4 restore into a brand-new, empty copy"
mkcopy "$W/restore"; keys "$PEPPER" "$DATA_KEY" "$W/restore"
node "$ROOT/scripts/d1-restore-order.cjs" "$W/backup/db.sql" "$W/backup/db.restore.sql"   # see the script: the raw export does not restore as-is
( cd "$W/restore" && npx wrangler d1 execute DB --local --yes --file "$W/backup/db.restore.sql" > "$W/logs/import.log" 2>&1 ) || { echo "IMPORT FAILED: see $W/logs/import.log"; tail -5 "$W/logs/import.log"; exit 1; }
while read -r k; do [ -z "$k" ] && continue; ( cd "$W/restore" && npx wrangler r2 object put "$BUCKET/$k" --local --file "$W/backup/r2/$k" > /dev/null 2>&1 ); done <<< "$KEYS"
PENDING="$( cd "$W/restore" && npx wrangler d1 migrations list DB --local 2>&1 | grep -c '0016\|0017' || true )"
echo "   migrations still pending after restore: $PENDING (0 means the migration history came with the backup)"

echo "== 4/4 verify the restored copy (escrowed keys), then with a WRONG data key"
serve "$W/restore" 8791 restore
node "$ROOT/scripts/backup-drill.cjs" verify 8791 "$W/expected.json"; V=$?
stop 8791
keys "$PEPPER" "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" "$W/restore"
serve "$W/restore" 8791 restore-wrongkey
node "$ROOT/scripts/backup-drill.cjs" wrongkey 8791 "$W/expected.json"; K=$?
stop 8791
[ "$V" -eq 0 ] && [ "$K" -eq 0 ] && [ "$PENDING" = "0" ] && echo "DRILL PASSED" || { echo "DRILL FAILED (logs: $W/logs)"; exit 1; }

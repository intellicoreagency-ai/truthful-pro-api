# Backup and restore

This procedure is **tested**. `bash scripts/backup-restore-drill.sh` runs it end to end on local test data and passes 11/11 checks (last run 22 Nov 2026). It has **not yet been run on the real Cloudflare staging account**; that drill is step 6 of `STAGING.md`.

## What must be backed up: all four, or a restore is incomplete

| Part | Where it lives | What it holds | Can it be recreated? |
|---|---|---|---|
| **Database** | D1 `truthful-pro-v2-db` | Customers, requests, events, missing documents, quotes, invoices and the money ledger, consents, staff (roles, active flag, encrypted authenticator secrets, passkeys), audit log, migration history | No |
| **Files** | R2 `truthful-pro-v2-documents` | Every uploaded and delivered document, already **encrypted** with `DATA_KEY` | No |
| **`DATA_KEY`** | Worker secret (cannot be read back from Cloudflare) | Opens every file, customer email and phone, and staff authenticator secrets | **No.** If lost, every file and encrypted field is permanently unreadable. |
| **`PEPPER`** | Worker secret | Phone-number hashes used to find accounts at sign-in | **No.** If lost, nobody can sign in to their existing account. |

The drill proves the last two rows: with a wrong `DATA_KEY`, the restored copy cannot even verify the owner's authenticator.

Other secrets can be rotated, not restored:

- `WA_APP_SECRET`, `WA_TOKEN`, email keys and `SCANNER_TOKEN`: issue new ones.
- `OWNER_SETUP_KEY`: only used once.

Configuration (`wrangler.toml`) is in git.

## Key escrow (do this once, before real data exists)

1. Generate `DATA_KEY` and `PEPPER` offline:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Store both in the company password manager, in a vault two named people can open, plus one sealed offline copy.
3. Set them on the Worker with `wrangler secret put`.
4. Never commit them, send them by message or email, or reuse them between staging and production.
5. Record in the vault the date, the environment (staging or production) and who set them.

## Routine protection

- **Point-in-time recovery (built in).** D1 Time Travel can restore the database to any minute within **30 days** on Workers Paid, or 7 days on Free. It is always on and costs nothing extra.
  - Record the bookmark before every migration or bulk change:
    ```
    wrangler d1 time-travel info truthful-pro-v2-db
    ```
  - A Time Travel restore **overwrites the database in place**. It is for "undo the last bad change", not for a second copy.
- **Independent copy (needed for anything older than 30 days, or if the account itself is at risk).** Run this nightly, keep 90 days, store outside the production account:
  ```
  wrangler d1 export truthful-pro-v2-db --remote --output db-YYYY-MM-DD.sql
  ```
- **Files.** Copy the bucket nightly to a backup bucket in a separate account or provider: `rclone sync` with the R2 S3 endpoint, or Super Slurper.
  - The objects are already ciphertext, so the backup copy never holds readable documents.
  - Add an R2 bucket lock (retention) on the backup bucket so a mistake or attack cannot delete it.

## Restore into a SEPARATE database (verified procedure)

1. Create a new, empty D1 database and R2 bucket. Never restore over production first.
2. Make the export restorable:
   ```
   node scripts/d1-restore-order.cjs db.sql db.restore.sql
   ```
   **Why this is needed:** the drill found that a raw `wrangler d1 export` of this schema **does not import as-is**.
   - Tables rebuilt by a migration (`requests`) are written after the tables that reference them, so the first row fails with `no such table: main.requests`.
   - The protection triggers would also refuse already-final quotes and ledger rows.

   The script keeps every statement exactly once and only reorders them: tables, then rows (with foreign-key checks deferred), then indexes, then triggers.
3. Import:
   ```
   wrangler d1 execute <new-db> --remote --file db.restore.sql
   ```
   Confirm `wrangler d1 migrations list <new-db> --remote` shows nothing pending.
4. Put every object back into the new bucket under the **same key**: `rclone copy`, or `wrangler r2 object put <bucket>/<key> --file …`.
5. Point a staging Worker at the new database and bucket, with the **escrowed** `DATA_KEY` and `PEPPER`.
6. Verify. The drill checks each of these:
   - the owner signs in with the same authenticator and keeps the owner role
   - every staff member keeps their role and active/inactive flag
   - requests, assignee, delivery and receipt state are intact
   - customer emails open
   - every file decrypts to the same SHA-256
   - money totals and document numbers are identical
   - an invoice renders
   - a customer signs in with their phone and sees their requests
   - the ledger still refuses to cancel an invoice that holds money
7. Only after step 6 passes, and only by a deliberate decision, switch production to the restored copy.

## Drill schedule

- Run the local drill (`scripts/backup-restore-drill.sh`) on every schema change. It is fast and uses no real data.
- Run the real staging drill (steps 1–6, against `--remote` staging resources) before launch and then quarterly. Record the date, who ran it, the result and the restore time.

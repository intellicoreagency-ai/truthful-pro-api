# Document review: manual review is the official method (no OCR)

Owner decision, 22 Nov 2026: OCR (automatic reading of documents) is **not** implemented. **Manual review** by a staff member is the adopted method for now.

## What that means in the product

- **The customer uploads.** The server checks each file:
  - the real file type, from the bytes (PDF/JPG/PNG)
  - size
  - the virus scan

  It then stores the file encrypted. Nothing reads its content automatically.
- **A staff member opens each document** in the dashboard viewer and decides:
  - **Accept.** The request can move on.
  - **Ask for a replacement or a missing document.** The customer sees exactly what is needed, with a note.
- **Rules that need a value from the document are typed in by the staff member**, not read automatically. Example: passport expiry at least 6 months, entered with **"قراءة انتهاء الجواز"**. The rule engine then checks the typed value, records the result and the evidence, and blocks the request if it fails.
- **An owner or manager can override a failed check, with a written reason.** The override is recorded in the log.
- **Name mismatches are flagged by the staff member** (**"تسجيل اختلاف اسم"**).

## Why this is safe to launch with

- Every decision has a person, a time and a reason in the request's log.
- Nothing is submitted to an authority without a staff member having reviewed the files.
- The customer never sees internal notes or rule details. They see only what is needed from them.

## If OCR is added later

It should only **suggest** values (e.g. the expiry date) for the staff member to confirm. Manual confirmation stays the rule.

The documents are government IDs and passports. Any OCR provider must therefore be reviewed for privacy and data location before use.

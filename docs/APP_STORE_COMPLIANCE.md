# App Store / Google Play readiness (checked 22 Nov 2026)

Checked against the App Review Guidelines and the code on branch `claude/glass-step5-transaction-details`.

## Met in the app

| Requirement | Where |
|---|---|
| **Account deletion inside the app** (5.1.1(v)) | Account → Security & Privacy → "Delete my account". Asks for confirmation, then deletes on the server (`DELETE /v1/me`): requests, files and personal data. |
| **Data export** | Same screen → "Export my data". |
| **Privacy Policy and Terms reachable in the app** | Sign-in screen, the request consent step, and Account → Security & Privacy. |
| **Public Privacy Policy / Terms URL** (for App Store Connect and Google Play) | `https://<worker host>/legal/privacy` and `/legal/terms`, generated from the same texts the app shows (`mobile/scripts/export-legal-pages.mts`). The Privacy Policy was adopted by the owner on 22 Nov 2026 (version `2026-11-22`). The Terms are still a draft. |
| **Sign in with Apple** (4.8) | **Not required today.** Customers sign in with their own email and password (since 22 Nov 2026). The mobile number is confirmed once, at registration, with one WhatsApp message to the company; that is number verification, not a third-party login. **If Google sign-in is added later, Sign in with Apple must be added at the same time.** |
| **No placeholder or sample data in production** | Sample screens, the on-device "demo request" and "preview" wording appear only in development and staging builds (`mobile/src/env.ts`). In production, a guest who finishes a request is asked to sign in, and the request is kept as a draft. |
| **Payments** (3.1) | The services are real-world services (government clearance), so in-app purchase does not apply. The customer approves a written quotation first. There is no payment gateway in the app. |
| **Encryption export question** | `ITSAppUsesNonExemptEncryption: false` (standard HTTPS only). |
| **Permission texts** | Photo library: used only when the customer chooses a profile picture. Camera and microphone: not requested. Documents use the system file picker (no permission needed). |
| **Tracking / ATT** | No tracking, no ads, no third-party analytics, so no tracking prompt. |
| **Accessibility** | Labels on every control; Dynamic Type capped at ×1.35; Reduce Motion stops the live hero and parallax. |

## Must be done before submitting (owner decisions or external)

1. **Access for the App Review team** (2.1). Now simpler: create a review account in production in advance (email + password) and give Apple those credentials in the review notes. The reviewer must not delete it; the review notes say so. Registering a *new* account still needs a WhatsApp confirmation, which a reviewer cannot do; say so in the notes.
2. **Terms of Use** still marked draft (`LEGAL_VERSION`). A UAE-licensed lawyer's review of both documents is still recommended.
3. **Apple Developer account in the company's name** (D-U-N-S). Recommended because the app handles government documents and IDs.
4. **App Privacy "nutrition label"** in App Store Connect:
   - Data collected and linked to the user: name, phone, email, documents (passport, Emirates ID…), profile photo (on the device only).
   - Not used for tracking.
5. **Approved price ranges** (optional). A range appears on a service page only after it is added, with the owner's approval, to `mobile/src/priceGuide.ts`.
6. **A real WhatsApp round trip in production** (Meta set-up), the production virus scanner, and production keys in escrow.

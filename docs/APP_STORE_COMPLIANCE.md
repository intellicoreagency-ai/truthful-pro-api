# App Store / Google Play readiness (checked 22 Nov 2026)

Checked against the App Review Guidelines and the code on branch `claude/glass-step5-transaction-details`.

## Met in the app

| Requirement | Where |
|---|---|
| **Account deletion inside the app** (5.1.1(v)) | Account → Security & Privacy → "Delete my account". Asks for confirmation, then deletes on the server (`DELETE /v1/me`): requests, files and personal data. |
| **Data export** | Same screen → "Export my data". |
| **Privacy Policy and Terms reachable in the app** | Sign-in screen, the request consent step, and Account → Security & Privacy. |
| **Public Privacy Policy / Terms URL** (for App Store Connect and Google Play) | `https://<worker host>/legal/privacy` and `/legal/terms`. They are generated from the same texts the app shows (`mobile/scripts/export-legal-pages.mts`) and are marked as a draft until the lawyer approves them. |
| **Sign in with Apple** (4.8) | **Not required.** It is only required when an app uses a third-party or social login (Google, Facebook…). This app has its own account, identified by the customer's mobile number, which is confirmed with one WhatsApp message to the company. That is number verification, not "login with WhatsApp". Say so in the review notes. |
| **No placeholder or sample data in production** | Sample screens, the on-device "demo request" and "preview" wording appear only in development and staging builds (`mobile/src/env.ts`). In production, a guest who finishes a request is asked to sign in, and the request is kept as a draft. |
| **Payments** (3.1) | The services are real-world services (government clearance), so in-app purchase does not apply. The customer approves a written quotation first. There is no payment gateway in the app. |
| **Encryption export question** | `ITSAppUsesNonExemptEncryption: false` (standard HTTPS only). |
| **Permission texts** | Photo library: used only when the customer chooses a profile picture. Camera and microphone: not requested. Documents use the system file picker (no permission needed). |
| **Tracking / ATT** | No tracking, no ads, no third-party analytics, so no tracking prompt. |
| **Accessibility** | Labels on every control; Dynamic Type capped at ×1.35; Reduce Motion stops the live hero and parallax. |

## Must be done before submitting (owner decisions or external)

1. **Access for the App Review team** (2.1). Apple must be able to sign in, and a reviewer cannot send a WhatsApp message from a UAE number.
   - Proposal: one review phone number on an allow-list in production, signing in with the same "confirm without WhatsApp" button staging uses.
   - Limits: only that number, only while a production switch is on, every use audited.
   - This account must not be deletable by the reviewer; the review notes say so.
   - Needs the owner's approval because it touches production sign-in.
2. **Lawyer-approved Terms and Privacy Policy.** The public pages show "draft" until `LEGAL_VERSION` changes.
3. **Apple Developer account in the company's name** (D-U-N-S). Recommended because the app handles government documents and IDs.
4. **App Privacy "nutrition label"** in App Store Connect:
   - Data collected and linked to the user: name, phone, email, documents (passport, Emirates ID…), profile photo (on the device only).
   - Not used for tracking.
5. **Approved price ranges** (optional). A range appears on a service page only after it is added, with the owner's approval, to `mobile/src/priceGuide.ts`.
6. **A real WhatsApp round trip in production** (Meta set-up), the production virus scanner, and production keys in escrow.

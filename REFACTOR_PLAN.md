# Dubai Clearance — Glassmorphism Refactor Plan

## Scope

Preserve existing content, functionality, API contracts, validation,
permissions, Arabic/English translations, and navigation behavior.

Apply the new glass design only to legacy screens. Keep the existing
Navigation, WhatsApp OTP, Dashboard, and New Request Form working.

## Shared design foundation

- [ ] Audit existing routes and identify legacy components.
- [ ] Reuse the existing Cairo font loader at the app root.
- [ ] Create shared color, spacing, radius, and shadow tokens.
- [ ] Create a reusable GlassCard using expo-blur with tint="light".
- [ ] Give glass cards a translucent white surface and subtle white border.
- [ ] Keep shadows on an outer View so rounded clipping preserves blur.
- [ ] Provide a readable translucent fallback when blur is unavailable.
- [ ] Create shared buttons, status badges, headers, and input components.
- [ ] Use StyleSheet only; no HTML, CSS, or NativeWind.
- [ ] Support RTL/LTR, safe areas, screen readers, and enlarged text.
- [ ] Keep text contrast readable over every glass background.
- [ ] Respect reduced-transparency preferences with an opaque fallback.

## Typical legacy screens

Refactor only screens that actually exist. Preserve route names and links.

- [ ] OldHome: header, service shortcuts, banners, and support actions.
- [ ] OldServices: categories, search, filters, and service cards.
- [ ] OldServiceDetails: requirements, fees, and start-request action.
- [ ] OldRequests: transaction list, filters, search, and empty state.
- [ ] OldTransactionDetails: status, dates, documents, and financial details.
- [ ] OldProfile: personal details, language, preferences, and sign-out.
- [ ] OldDocuments: upload, preview, replacement, and download.
- [ ] OldNotifications: read/unread states and navigation targets.
- [ ] OldPayments: quotes, payment states, invoices, and receipts.
- [ ] OldSupport: support contacts and request context.
- [ ] OldSettings: accessibility, notification, and privacy preferences.

## Per-screen checklist

- [ ] Record current functionality and capture the current screen.
- [ ] Replace legacy presentation with shared glass components.
- [ ] Preserve business logic and authorization checks.
- [ ] Preserve all labels, actions, and supported languages.
- [ ] Add loading, error, retry, and empty states where missing.
- [ ] Avoid nested scrolling and excessive full-screen blur layers.
- [ ] Verify keyboard behavior and small-screen layouts.
- [ ] Verify back navigation and deep links.
- [ ] Verify accessibility labels and non-color status descriptions.
- [ ] Compare before/after behavior and approve visual changes.

## Verification and rollout

- [ ] Run TypeScript and existing regression tests.
- [ ] Test on physical Android and iOS devices.
- [ ] Check blur rendering and fallback behavior on both platforms.
- [ ] Check Arabic shaping, RTL order, and maximum text size.
- [ ] Check reduced transparency and screen-reader navigation.
- [ ] Refactor incrementally on a separate branch.
- [ ] Remove legacy components only after checking every reference.
- [ ] Keep production deployment separate from UI refactoring.

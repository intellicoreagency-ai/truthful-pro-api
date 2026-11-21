# Dubai Clearance — Glassmorphism Refactor Plan

Branch: `claude/glass-step5-transaction-details` (from `claude/dubai-clearance-app-o1mje9`).

## Scope

Preserve existing content, functionality, API contracts, validation,
permissions, Arabic/English translations, and navigation behavior.

Apply the new glass design only to legacy screens. Keep the already
redesigned screens working and unchanged:

- Step 1 — Navigation: `mobile/src/navigation/TabBar.tsx`, `TabBarLayout.tsx`, `tabs.ts`
- Step 2 — WhatsApp sign-in: `mobile/src/auth/` (`AuthFlow`, `LoginScreen`, `RegisterScreen`, `WaitingStep`, `ContactScreen`)
- Step 3 — Dashboard (My Requests list): `mobile/src/dashboard/DashboardScreen.tsx`
- Step 4 — New Request form: `mobile/src/newRequest/NewRequestScreen.tsx`, `SelectSheet.tsx`

## How this app is wired (facts that shape every step)

- No Expo Router and no `app/` folder. `mobile/index.ts` → `mobile/App.tsx`, which
  switches on a `page` state: `welcome | home | services | detail | requests | profile | request | newrequest`.
  Screens are components with props; there are no URL routes or deep links to preserve yet.
- API: `mobile/src/api.ts` (`call()` adds the bearer token, refreshes it, handles session expiry).
  Server → app mapping: `mobile/src/syncMap.ts`. Model and formatters: `mobile/src/clientModel.ts`.
- Text: `mobile/src/ui/Txt.tsx` — **decided: Cairo for Arabic, system font for English on every refactored screen**
  (recorded in `.claude/skills/apple-design/SKILL.md`). Legacy screens still use IBM Plex Sans Arabic / Plus Jakarta Sans
  via `AppText` (App.tsx) and `RefText` (ReferenceUI.tsx) until refactored.
- Glass building blocks: `mobile/src/ui/Glass.tsx` (`GlassCard`, `GlassButton`, `IconButton`, `GlassField`, `ValueRow`, `Note`, `SectionTitle`, `useReduceTransparency`, `ltr`).
- Tokens: `mobile/src/theme.ts`. Touch: `Pressable` from `mobile/src/Touch.tsx`. Icons: `mobile/src/Icons.tsx` (SVG).
- Not installed: `expo-router`, `@expo/vector-icons`, `react-native-reanimated`. Don't add them without a decision.
- Safe areas are applied once in App.tsx (`SafeAreaView`); screens must not add insets again.

## Shared design foundation

- [x] Audit existing routes and identify legacy components (see below).
- [x] Reuse the existing Cairo font loader at the app root (`useFonts` in App.tsx).
- [x] Shared color, spacing, radius and type tokens exist: `theme.ts` (`colors`, `space`, `radius`, `type`, `layout`, `glass`, `onGlass`).
- [x] Reusable light `GlassCard` in `mobile/src/ui/Glass.tsx`.
      Note: `auth/AuthKit.tsx` keeps its own dark `GlassCard` for the photo-backed sign-in screens.
- [x] Glass cards: translucent white surface, subtle white border, shadow on an outer View.
- [x] Readable translucent fallback when blur is unavailable (Android uses `dimezisBlurView`, denser fill elsewhere).
- [x] Shared buttons, inputs, value rows and notes in `mobile/src/ui/Glass.tsx`.
- [ ] Move the status badge and screen header (local to Request details) into `mobile/src/ui/` when the next screen needs them.
- [x] StyleSheet only; no HTML, CSS or NativeWind.
- [ ] RTL/LTR, screen readers and enlarged text checked on each screen (`maxFontSizeMultiplier` via `Txt`).
- [ ] Text contrast readable over every glass background.
- [x] Reduced-transparency preference respected with an opaque fallback (Step 5 pattern).
- [x] Font decision: Cairo (Arabic) + system font (English); design rules updated.

## Legacy screens (real names in the repo)

Refactor only these. Preserve page names and the Android back order in App.tsx (`backRef`).

| # | Screen | Where | What it contains |
|---|--------|-------|------------------|
| 5 | **Request details** ✅ | `DetailDesign` in `src/ClientDesign.tsx`, shown by `ClientWorkspace` (page `requests`, `selected` set) | status, progress, dates, files, receipt confirmation, share, export, delivery-problem report, `FinancePanel` + `GovSection` (in `ClientWorkspace.tsx`) |
| 6 | Missing documents | `MissingDesign` in `src/ClientDesign.tsx` (`tab==='missing'`) | requested documents, pick replacement, send to team |
| 7 | Request files | files tab inside `ClientWorkspace` (`tab==='files'`, `RefHeader` + `fileRow`) | view / save each file |
| 8 | Share sheet | `ShareDesign` in `src/ClientDesign.tsx`, in a `Modal` in `ClientWorkspace` | summary, financial toggle, files, invoice, email / WhatsApp / system share |
| 9 | Home | `src/HomeScreen.tsx` (page `home`, uses `ReferenceUI` sprites) | header, individuals/companies shortcuts, search, WhatsApp/phone support, notifications bell |
| 10 | Services catalogue | `cataloguePage()` in `App.tsx` (page `services`) | audience segment, search, approved service banners, empty state |
| 11 | Service details | `detailPage()` + `detailCTA()` in `App.tsx` (page `detail`) | banner, favorite, About / Documents / Fees tabs, transaction picker, start-request CTA in tab bar |
| 12 | Request wizard | `RequestWizard` in `src/ClientWorkspace.tsx` (page `request`) | 5 steps: details, documents (upload/preview/replace), review + consent, payment (disabled), confirm |
| 13 | Account | `src/AccountScreen.tsx` (page `profile`) | personal details, email, language, favorites, data export, delete account, sign-out, legal links |
| 14 | Legal | `src/LegalScreen.tsx` (overlay from `legal` state) | Terms / Privacy text |
| 15 | Fallback page | `simplePage()` in `App.tsx` | saved drafts list / preview notice |

Not present as separate screens (don't invent them): Notifications (the bell opens My Requests),
Payments (lives in `FinancePanel` inside Request details), Settings (inside Account),
Support (WhatsApp/phone buttons on Home; Step 5 adds a WhatsApp button on Request details).

## Step 5 — Request details (done)

- [x] `mobile/src/details/TransactionDetailsScreen.tsx` replaces `DetailDesign` (removed from `ClientDesign.tsx`).
- [x] All actions kept: progress stages, "where am I / action needed", dates, financial details, final files
      (view / save), all request files, share sheet, export summary, receipt confirmation, problem report,
      complete missing documents, and the invoice & payment panel.
- [x] Payments panel moved to `mobile/src/details/FinancePanel.tsx` with its logic unchanged (glass presentation only).
- [x] Fixed on the way: "Complete documents" and the problem-report form only appeared for completed requests;
      the "All request files" action was never shown.
- [x] Added: fresh server copy on open (`fetchRequest`, skipped while local changes wait to upload),
      pull-to-refresh (full sync), WhatsApp support button.
- [x] Android back: unchanged, owned by `ClientWorkspace` (share sheet → files/missing → details → list).
- [x] Checked in the web preview (390 pt wide, Arabic and English): renders without errors; receipt, files,
      back and share work on the sample requests.
- [ ] Check on physical iOS and Android devices (blur, ripple, font scale, VoiceOver/TalkBack).

Next screen: **6 — Missing documents** (`MissingDesign`), then 7 — Request files, 8 — Share sheet.

## Per-screen checklist

- [ ] Record current functionality and capture the current screen.
- [ ] Replace legacy presentation with shared glass components.
- [ ] Preserve business logic and authorization checks.
- [ ] Preserve all labels, actions, and supported languages.
- [ ] Add loading, error, retry, and empty states where missing.
- [ ] Avoid nested scrolling and excessive full-screen blur layers.
- [ ] Verify keyboard behavior and small-screen layouts.
- [ ] Verify Android back order (modal → tab → screen → home).
- [ ] Verify accessibility labels and non-color status descriptions.
- [ ] Compare before/after behavior and approve visual changes.

## Verification and rollout

- [x] `npm run typecheck` (mobile) and `npm test` (4 groups) pass on this branch.
- [ ] Test on physical Android and iOS devices.
- [ ] Check blur rendering and fallback behavior on both platforms.
- [ ] Check Arabic shaping, RTL order, and maximum text size.
- [ ] Check reduced transparency and screen-reader navigation.
- [x] Refactor incrementally on a separate branch.
- [ ] Remove legacy components only after checking every reference.
- [ ] Keep production deployment separate from UI refactoring.

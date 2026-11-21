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
- [x] Status badge, screen header, stage tracker, tags, checkboxes and the screen frame live in `mobile/src/ui/Glass.tsx`.
- [x] StyleSheet only; no HTML, CSS or NativeWind.
- [x] RTL/LTR and accessibility labels/roles/states checked on each screen (web preview).
- [ ] Enlarged text (`maxFontSizeMultiplier` 1.35 via `Txt`) checked on devices.
- [ ] Text contrast readable over every glass background.
- [x] Reduced-transparency preference respected with an opaque fallback (Step 5 pattern).
- [x] Font decision: Cairo (Arabic) + system font (English); design rules updated.

## Legacy screens — all refactored ✅

| # | Screen | Now | Was |
|---|--------|-----|-----|
| 5 | Request details ✅ | `src/details/TransactionDetailsScreen.tsx` (+ `FinancePanel.tsx`) | `DetailDesign` in `ClientDesign.tsx` |
| 6 | Missing documents ✅ | `src/details/MissingDocumentsScreen.tsx` | `MissingDesign` |
| 7 | Request files ✅ | `src/details/RequestFilesScreen.tsx` | files tab in `ClientWorkspace` |
| 8 | Share sheet ✅ | `src/details/ShareSheet.tsx` | `ShareDesign` + `Modal` |
| 9 | Home ✅ | `src/HomeScreen.tsx` | sprite-based reference screen |
| 10 | Services catalogue ✅ | `src/services/ServicesScreen.tsx` | `cataloguePage()` in `App.tsx` |
| 11 | Service details ✅ | `src/services/ServiceDetailsScreen.tsx` (+ `StartRequestBar`) | `detailPage()` / `detailCTA()` |
| 12 | Request wizard ✅ | `src/request/RequestWizard.tsx` | `RequestWizard` in `ClientWorkspace.tsx` |
| 13 | Account ✅ | `src/AccountScreen.tsx` | same file, legacy UI |
| 14 | Legal ✅ | `src/LegalScreen.tsx` | same file, legacy UI |
| 15 | Fallback page ✅ | `src/FallbackScreen.tsx` | `simplePage()` (request form was unreachable) |

`ClientWorkspace.tsx` is now only the My Requests coordinator (list + request layers + share sheet + back order).
Removed: `ClientDesign.tsx`, the legacy `RefText/RefButton/RefHeader/ReferenceProgress` kit (ReferenceUI keeps only
`officialLogo`, `RefSprite`, `ContactGlyph`), and dead code in `App.tsx`. The release gate `allowRealSubmission=false` stays.
Unchanged on purpose: approved banner artwork (`CompanyBanner`, approved banners) and the Step 1 tab bar fonts.

## Bugs fixed during the refactor

- Request details: "Complete documents" and the problem report only rendered for completed requests; "All request files" never shown.
- Missing documents: back went to the list (system back went to details); Send enabled with nothing requested; no hint why Send was off.
- Share: "Invoice and receipts" looked selected without an invoice; "Include financial amounts" could be ticked without a summary.
- Home: Arabic banner and service cards were images of text (now real text); language switch and search were wired but never shown.
- Wizard: Continue never said what was missing; documents that stopped applying (age rule) were still submitted;
  "if applicable (if applicable)"; consent box showed "+".
- Account: notifications always 0 (now requests needing action; Home's bell uses the same rule); Saved documents
  unreachable; invalid email saved silently; destructive delete looked neutral.
- Legal: Android back closed the screen underneath instead of the Terms/Privacy overlay.
- Web preview: `isReduceTransparencyEnabled` crashed react-native-web; checkbox/tab state now also exposed on web.

## Premium phase (concierge design) — done

Every screen, including Sign-in and New Request, uses one premium system:
- `mobile/src/ui/Premium.tsx`: `ScalePressable` (spring + haptic, layout styles moved to its wrapper), `Entrance`
  (staggered spring fade-up), `GoldText`, `GoldBadge`, `LuxCard` (blur + ivory sheen + gold gradient hairline + warm shadow).
- `mobile/src/ui/Glass.tsx` builds on it: gold-glass cards, gradient buttons, gold screen titles, sections that rise in
  (keyed by React's stable keys so nothing remounts).
- `theme.ts` → `lux` tokens. Accessible action colour: espresso text on bright orange (`lux.orange`, ≈ 7:1);
  white icons only on the deeper orange (`lux.orangeDeep`). White text on bright orange (≈ 2.4:1) is not used.
- Floating glass tab bar with a raised gold-ringed "+", springy gold selection pill, mirrored order in Arabic.
- New packages (SDK 58 / Expo Go versions): react-native-reanimated 4.7.1, react-native-worklets 0.13.0,
  expo-linear-gradient, expo-haptics, @react-native-masked-view/masked-view 0.3.2.
- Motion off under Reduce motion; glass opaque under Reduce transparency.
- Still to do on devices: blur, gold gradient text (web shows a flat-gold fallback), haptics, springs, large text, VoiceOver/TalkBack.

## Per-screen checklist

- [ ] Record current functionality and capture the current screen.
- [x] Replace legacy presentation with shared glass components.
- [x] Preserve business logic and authorization checks (logic copied unchanged; fixes listed above).
- [x] Preserve all labels, actions, and supported languages.
- [x] Add loading, error, retry, and empty states where missing.
- [x] Avoid nested scrolling and excessive full-screen blur layers (one ScrollView per screen; blur only on cards/sheet).
- [ ] Verify keyboard behavior and small-screen layouts.
- [x] Verify Android back order (modal → tab → screen → home) in code; confirm on a device.
- [x] Verify accessibility labels and non-color status descriptions.
- [ ] Compare before/after behavior and approve visual changes (owner review).

## Verification and rollout

- [x] `npm run typecheck` (mobile) and `npm test` (4 groups) pass on this branch.
- [x] Web preview walk-through (390 pt, Arabic and English): every refactored screen and its main actions, no page errors.
- [ ] Test on physical Android and iOS devices.
- [ ] Check blur rendering and fallback behavior on both platforms.
- [ ] Check Arabic shaping, RTL order, and maximum text size.
- [ ] Check reduced transparency and screen-reader navigation.
- [x] Refactor incrementally on a separate branch.
- [x] Remove legacy components only after checking every reference.
- [x] Keep production deployment separate from UI refactoring (nothing deployed).

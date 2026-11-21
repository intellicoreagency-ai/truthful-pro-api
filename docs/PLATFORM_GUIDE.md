# Cross-platform guide (iOS + Android)

**Principle.** Apple's Human Interface Guidelines are the base for the brand system (type hierarchy, spacing rhythm, semantic colour roles, clarity, generous touch targets). The **approved Truthful look is kept** (fonts, colours, banners); platform behaviour is native on each OS.

| Area | Base (HIG) | Android exception (native behaviour) | Where it lives |
|---|---|---|---|
| Touch feedback | Controls dim while pressed (opacity 0.6) | **Material ripple**, clipped to the control, no dimming | `mobile/src/Touch.tsx` (`Pressable` drop-in used everywhere) |
| Touch targets | ≥ 44 pt | ≥ 48 dp: the touch area is extended by 4 dp via `hitSlop` without changing layout | `Touch.tsx` |
| Back | Swipe-back / in-app back button | **System back button/gesture** closes the top-most layer first: modal → step → screen → home → exit. Predictive back is off (JS back handlers need the classic callback). The sign-in verification step returns to phone entry instead of closing the app | `App.tsx` `backRef`, `ClientWorkspace`, `AccountScreen`, `WelcomeScreen`, Modal `onRequestClose` |
| Keyboard | Content stays visible, taps pass through | `softwareKeyboardLayoutMode: resize`; scroll views use `keyboardShouldPersistTaps="handled"` | `app.json`, ScrollViews |
| Text fields | Rounded bordered fields | No default Android underline (`underlineColorAndroid="transparent"`) | all `TextInput` |
| Dynamic type | Honour the user's text size | Same, with `maxFontSizeMultiplier=1.35` so the approved layout does not break | all `Text`/`TextInput` |
| Status/nav bars | Safe-area insets | Edge-to-edge enabled; `SafeAreaView` on all four edges | `app.json`, `App.tsx` |
| Share / files | Share sheet, document picker | Android share intent and document picker via Expo modules | `clientStorage.ts` |
| Language / direction | RTL mirrored for Arabic | Same; layout direction is controlled per screen so the approved design is not mirrored twice | `App.tsx` |

## Rules for new UI
1. Use `Pressable` from `src/Touch.tsx`, never directly from `react-native`.
2. Any screen, sheet or step that can be "closed" must register back handling (or use a `Modal` with `onRequestClose`).
3. Keep controls ≥ 44 pt tall; spacing on a 4/8 pt rhythm; no hard-coded colours outside the brand palette (`C` in `App.tsx` and the reference UI).
4. Test on both platforms: iOS simulator (pressed highlight, swipe-back area, keyboard) and Android emulator (ripple, hardware back at every depth, resize on keyboard, large font scale 130 %).

## Checklist before release (needs real devices)
- [ ] Android: back from each depth (welcome step → welcome, request wizard step → previous, detail → list, legal → previous, modal → closed, home → exits).
- [ ] Android: ripple visible on every button, tabs, cards, list rows; no dimming.
- [ ] iOS: pressed highlight on the same controls; no ripple.
- [ ] Both: font scale 100 % / 130 %, Arabic (RTL) and English, keyboard over each input, notch/cut-out and gesture-bar insets.

## Navigation (Step 1)
- Tokens: `mobile/src/theme.ts` (colours, 4 pt spacing, radii, HIG type scale, touch minimums).
- Tabs: `mobile/src/navigation/tabs.ts` (five root destinations; `activeTab`, `showsTabBar`).
- Translucent bottom tab bar: `mobile/src/navigation/TabBar.tsx` (`expo-blur` system-chrome blur + warm tint, hairline, 49 pt + home-indicator inset, 11 pt labels, raised primary action, Material ripple on Android). On Android the content behind the bar is wrapped in a `BlurTargetView`.
- Layout: `mobile/src/navigation/TabBarLayout.tsx` — screens use its `ScrollView`, which scrolls content *under* the bar and keeps the last item clear of it; the bar's height is measured, so the "Start request" accessory on a service page sits inside the same blur.

## Authentication (Step 2)
- `mobile/src/auth/` — `AuthFlow` (root of the signed-out area; Android back: register → login), `LoginScreen`, `RegisterScreen` (also used as the "finish your account" step for a number that signs in without an account), `AuthKit` (Apple-style building blocks: large title, 52 pt rounded fields with label above and focus ring, 14 pt-radius buttons, rounded consent checkboxes, fade+rise step transition that respects *Reduce Motion*), `useWaVerification` (WhatsApp confirmation + polling), `phone.ts`, `copy.ts` (Arabic/English strings).
- The product is **passwordless**: the user sends a ready-made WhatsApp message (free for them), the server verifies Meta's signed webhook, the app polls and receives rotating tokens. There is no password to type, reset or leak.
- **Tokens** are stored only through `expo-secure-store` (iOS Keychain / Android Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) in `src/api.ts`; on web they stay in memory only.
- Register records the three consents (terms, privacy, document processing) with the legal version once the session exists, then the name and the optional email (a welcome email with a confirmation link is sent only if email is configured). A failed consent save shows a retry; the user is not let in silently.
- Old `WelcomeScreen` (with a non-functional email/password preview) was removed.

### Email is essential contact data
- Registration requires a valid email (and the mobile number from the WhatsApp verification). A number that signs in without an account finishes the account (name, **email**, consents) first; an older account without an email is stopped by `ContactScreen` until it adds one.
- The server enforces it: a request cannot be submitted without an email on the account (`409 email_required`). Staff see the customer's email (with confirmed / not confirmed) and phone with call, WhatsApp and mail links on every request.
- The email is stored encrypted; invoices are emailed only after the customer confirms it from the welcome email.

### Login screen (main entry)
The approved Dubai cover (`assets/brand/cover-dubai.jpg`) is the hero of the Login screen (tall) and of the other auth screens (compact), with the brand mark and the language switch on it and a rounded sheet carrying the large title and the form. Note: the cover shows a third-party building brand (EMAAR signage); see `docs/ASSETS_RIGHTS.md` before a public launch.

### Database rule for the email
`users.email_enc` stays nullable (the account row is created at WhatsApp verification, before the email is entered, and older accounts exist), so the rule is enforced by migration `0015_email_required.sql` triggers: a request cannot leave *draft* for a customer without an email, and a live account cannot lose its email. The API also answers `409 email_required`.

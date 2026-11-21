---
name: apple-design
description: Apple Human Interface Guidelines as the design base for the Truthful Pro mobile app (iOS + Android, Expo/React Native). Use when creating or changing any screen, component, spacing, typography, colour or interaction in /mobile.
---

# Apple design guidelines for the mobile app

Scope: `/mobile` only (Expo + React Native + TypeScript, styled with `StyleSheet`). The dashboard, API and HTML templates are web code and are not covered here.

## Principle
Apple's Human Interface Guidelines (HIG) are the **base for the brand identity**: typography hierarchy, spacing rhythm, semantic colour roles, clarity and deference to content. The **approved Truthful look stays** (fonts, brand colours, banners, reference screens); this skill governs how new and changed UI is built around it. Behaviour must be **native on each platform**: Apple look as the base, Android interactions where the platform differs (see the last section).

## Typography
- Use a clear hierarchy, roughly the HIG text styles: Large Title 34, Title 28, Title 2 22, Headline 17 (semibold), Body 17, Callout 16, Subheadline 15, Footnote 13, Caption 12. Do not go below 11 pt for anything a user must read.
- Fonts (owner decision, Nov 2026): **Cairo** for Arabic (`CairoRegular`, `CairoSemiBold`, `CairoBold`, loaded in `App.tsx`) and the **platform system font** for English/Latin (SF Pro on iOS, Roboto on Android). Use `Txt` from `mobile/src/ui/Txt.tsx`, which applies this automatically. Every redesigned screen follows this; older fonts (IBM Plex Sans Arabic, Plus Jakarta Sans, Noto Sans Arabic, Open Sans) remain only on legacy screens until they are refactored, and on approved banner artwork. Never mix more than two weights on one screen; prefer regular, semibold and bold.
- Respect Dynamic Type / font scale on both platforms; every `Text` and `TextInput` is capped with `maxFontSizeMultiplier={1.35}` so layouts survive large system fonts.
- Arabic is first-class: right-aligned, `writingDirection: 'rtl'`, generous line height (≥ 1.4× size). Numbers and references (`#`, AED amounts, phone numbers) are isolated as LTR.

## Spacing and layout
- Spacing rhythm on a 4 pt grid, with 8 / 12 / 16 / 20 / 24 as the common steps. Standard screen margins 16 pt; keep related items closer than unrelated ones.
- Touch targets **≥ 44 × 44 pt** (iOS) and **≥ 48 × 48 dp** (Android). Make small visuals bigger by padding/`hitSlop`, not by enlarging the graphic.
- Respect safe areas on all four edges (notch, Dynamic Island, gesture bar, Android cut-outs) with `SafeAreaView`/`react-native-safe-area-context`.
- Use `flex` layouts and `StyleSheet.create`; never rely on fixed device widths. One primary action per screen, clearly distinguished.
- Corner radius: 10–14 for controls and fields, 16–24 for cards and sheets; use continuous-feeling rounding consistently.

## Colour
- Palette (owner decision, 21 Nov 2026 — **final, do not change**): **Sapphire & gold**. Pearl pages `#F3F5F8`, white/frosted-white glass cards, ink-navy text `#0E1526`, slate secondary text `#5B6475`, sapphire primary actions `#1D3A9E` with white text, champagne gold `#D9BC7E` for icons, rings and hairlines (gold as text only in the dark stops, e.g. `#76592A`), deep navy `#0A1430` for the Home hero wash and dark grounds. Champagne tints mark "needs attention"; no cream/beige surfaces.
- Service banners (`mobile/src/catalogue/CategoryBanner.tsx`): navy-sapphire text panel with a gold line-art medallion and real-text title, a gold S-wave, and the service photo on the far side (photo halves in `assets/banner_photos`, cropped from the approved artwork). Mirrored for Arabic. Never bake titles into images.
- Use semantic roles, not ad-hoc hex values: background, surface/card, primary (brand), secondary text, separators, success, warning, destructive. Define each once in `mobile/src/theme.ts` (`colors`, `lux`, `glass`, `onGlass`) and reuse.
- Contrast: body text ≥ 4.5:1, large text and icons ≥ 3:1. Never convey meaning with colour alone (add text or icon).
- The app is light-only (`userInterfaceStyle: light`); do not add dark-mode colours unless the product decision changes.

## Components and patterns
- Lists: clear rows, separators, chevrons only where a row navigates. Forms: label above field, inline validation in plain language, the keyboard never hides the field being edited.
- Buttons: filled for the primary action, tinted/bordered for secondary, destructive actions in the destructive colour and confirmed. Disabled controls look disabled and say why when it is not obvious.
- Sheets/modals for short, focused tasks; always dismissible (close button and system back).
- Feedback: every tap acknowledges immediately; long work shows progress; errors say what happened and what to do next. Prefer undo/confirmation over irreversible actions without warning.
- Motion is brief (≈ 200–300 ms), purposeful, and respects "reduce motion".
- Accessibility: every interactive element has `accessibilityRole` and a localized `accessibilityLabel`; state (selected, disabled, busy) is exposed; reading order follows visual order.

## Cross-platform behaviour (native on each OS)
- Use `Pressable` from `mobile/src/Touch.tsx` (never directly from `react-native`): iOS dims the control while pressed; **Android shows the Material ripple** clipped to the control.
- **Android system back button/gesture** must close the top-most layer first (modal → step → screen → home → exit). Every closable screen/sheet registers back handling or uses `Modal onRequestClose`.
- No Android text-field underline (`underlineColorAndroid="transparent"`); keyboard resizes content on Android; scroll views use `keyboardShouldPersistTaps="handled"`.
- Use platform sharing and file pickers through Expo modules; do not invent custom replacements.
- Details and the release checklist: see "Cross-platform guide" in the repository's documentation (`docs/PLATFORM_GUIDE.md`).

## Do / Don't (mobile)
- Do build UI only with React Native components (`View`, `Text`, `Pressable`, `ScrollView`, `FlatList`, `Image`, `TextInput`, `Modal`) styled with `StyleSheet.create`.
- Don't write HTML, CSS, class names or web-only APIs in `/mobile`; don't add NativeWind or any CSS-in-JS layer.
- Don't hard-code colours, font sizes or spacing in JSX; put them in `StyleSheet` entries based on the tokens above.

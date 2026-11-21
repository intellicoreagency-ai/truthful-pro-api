---
name: cross-platform
description: Rules for building one app that ships on both iOS and Android. Apple design is the brand base (typography, spacing, color); interactions, navigation and touch feedback follow each platform's native conventions. Use when designing or implementing screens, navigation, gestures, buttons, or any touch interaction for the mobile app.
---

# Cross-Platform (iOS + Android)

This app is deployed on **both iOS and Android**. Look is shared; behavior is native.

## Principle

- **Brand identity = Apple design guidelines.** Typography, spacing, color, radii, and layout come from the `apple-design` skill and the project's `DESIGN.md` tokens. Identical on both platforms.
- **Behavior = platform-native.** Navigation, gestures, touch feedback, and system integrations must feel native on each OS. Never ship iOS behavior to Android users (or vice versa) just for visual consistency.

## Shared across platforms (from apple-design)

- Type scale, weights, tracking, and hierarchy
- Color tokens, light and dark mode
- 8pt spacing grid, corner radii, whitespace
- Component visual styling (cards, buttons, inputs)
- Accessibility baseline: 44pt/48dp minimum touch targets (use 48dp on Android), contrast AA, reduced motion

## Android-native behavior (must follow)

- **System back**: The hardware/gesture/system back button must work on every screen. Back pops the navigation stack, closes the top sheet/modal/dialog first, then exits. Support predictive back where the framework allows. Never trap the user or ignore back.
- **No iOS-only affordances**: No swipe-from-left-edge-only back as the sole way to go back; always honor system back. No iOS-style bottom-sheet-only or action-sheet patterns where Android uses menus/dialogs.
- **Touch feedback**: Use **ripple** feedback on pressable surfaces (bounded on buttons/list items, unbounded on icon buttons). Do not substitute the iOS opacity/scale-down press effect on Android.
- **Navigation**: Bottom navigation bar or navigation drawer/rail per Android conventions for top-level destinations; top app bar with navigation icon (up/back) rather than iOS large-title centered style when it harms platform feel.
- **Dialogs, menus, pickers**: Use the native Android equivalents (alert dialog, popup/overflow menu, Material date/time pickers), styled with the shared brand tokens.
- **Status/navigation bars**: Handle edge-to-edge, system insets, and the gesture navigation bar. Match status bar icon color to the screen theme.
- **Text and settings**: Respect system font scale (sp), dark mode, and locale.

## iOS-native behavior (keep)

- Swipe-from-edge back gesture and interactive pop transition
- Opacity/highlight press feedback, haptics where appropriate
- Large-title navigation bars, tab bar at the bottom, action sheets, native pickers
- Safe-area insets (notch, Dynamic Island, home indicator)

## Implementation guidance

- Branch on platform for behavior, not for brand: e.g. `Platform.OS` (React Native), `Platform.isAndroid` (Flutter), or equivalent.
- Centralize tokens (colors, spacing, type) in one shared theme; centralize platform behavior in small wrappers (e.g. a `Pressable` that renders a ripple on Android and an opacity press on iOS; a navigation container that wires system back).
- Prefer the framework's native navigation stack so back handling, transitions, and predictive back come for free.
- Test every flow on both platforms, including: system back on each screen, back with an open sheet/modal, press feedback on all tappable elements, dark mode, and large font sizes.

## Checklist

- [ ] Visual identity matches apple-design tokens on both platforms
- [ ] System back works on every screen and closes overlays first (Android)
- [ ] Ripple touch feedback on Android; native press feedback on iOS
- [ ] Navigation pattern is native per platform
- [ ] Touch targets >= 48dp (Android) / 44pt (iOS)
- [ ] Insets and edge-to-edge handled on both
- [ ] Tested on a real or emulated device for each platform

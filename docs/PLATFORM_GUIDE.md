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

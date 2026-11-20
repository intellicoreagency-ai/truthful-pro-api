# Project rules

This repository has three parts:

- `mobile/` — the customer app, built using **Expo (React Native) and TypeScript** for **iOS and Android**.
- `dashboard/` — the staff web dashboard (React + Vite, web).
- `api/` — the Cloudflare Worker backend, including server-generated HTML documents and email templates.

## `mobile/` (strict)

This is a mobile app for iOS and Android. In `mobile/`:

- NEVER generate HTML, CSS, or web-based code.
- Always use React Native components (`View`, `Text`, `Pressable`, `ScrollView`, etc.).
- Style **only with React Native's standard `StyleSheet`** (`StyleSheet.create`). NativeWind is not used in this project and must not be added.
- Use `Pressable` from `mobile/src/Touch.tsx` for touch feedback (Android ripple, iOS highlight) and handle the Android system back button on every closable screen.
- Follow the Apple design guidelines from `.claude/skills/apple-design/SKILL.md`.

## `dashboard/`, `api/` and HTML templates

These are web-based, so they may freely use HTML, CSS and web APIs. The strict mobile rules above do not apply to them.

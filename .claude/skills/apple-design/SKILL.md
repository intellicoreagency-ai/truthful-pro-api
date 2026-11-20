---
name: apple-design
description: Apple-style design guidance (Human Interface Guidelines principles) for building clean, spacious, polished web UI. Use when the user asks for an "Apple look", Apple-style, HIG-inspired, minimal premium, or glassy/frosted interface, or when designing landing pages, docs, or product UI that should feel calm, precise, and content-first.
---

# Apple Design

Build interfaces that feel calm, precise, and content-first, following the spirit of Apple's Human Interface Guidelines (clarity, deference, depth). Adapt the principles to the web; do not copy Apple's trademarks, logos, or proprietary fonts.

## Before you start

1. Read `DESIGN.md`, `PRODUCT.md` and `.impeccable/design.json` if present. They define this project's brand tokens. Where they conflict with this skill, the project files win; apply this skill's *principles* (spacing, hierarchy, motion, accessibility) through the project's own tokens.
2. Do not invent product facts, metrics, or testimonials to fill space. Whitespace is fine; fake content is not.

## Core principles

- **Clarity**: One primary action per view. Text is legible, icons are unambiguous, purpose is obvious at a glance.
- **Deference**: UI chrome steps back; content is the hero. Remove borders, shadows and decoration that do not carry meaning.
- **Depth**: Use subtle layering (blur, soft shadow, elevation) to show hierarchy, not decoration.
- **Restraint**: Fewer colors, fewer weights, fewer components. Every element earns its place.

## Typography

- System font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, "Segoe UI", Roboto, sans-serif`. Use `ui-monospace, "SF Mono", Menlo, monospace` for code.
- Large, confident headlines (weight 600-700, tight tracking `-0.02em` to `-0.03em`, line-height 1.05-1.15); body 17px/1.47 with `-0.01em` tracking.
- Limit to ~4 sizes and 2-3 weights. Hierarchy comes from size and weight, not color noise.
- Body measure 60-75 characters. Use `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs.
- Support Dynamic Type spirit: size in `rem`, never lock text to px in a way that blocks user scaling.

## Color

- Neutral foundation: near-white `#fbfbfd` / `#f5f5f7` surfaces, near-black `#1d1d1f` text, secondary text `#6e6e73`.
- One accent color for interactive elements (links, primary buttons, focus). Default system blue `#0071e3` (light) / `#2997ff` (dark) unless the project defines its own accent.
- Semantic colors only for meaning: green success, red destructive/error, orange warning.
- Define tokens as CSS variables and provide a dark mode (`prefers-color-scheme`). Dark surfaces are `#000` / `#1c1c1e` / `#2c2c2e` layers, not flat gray.
- Meet WCAG AA contrast (4.5:1 body, 3:1 large text and UI components) in both modes.

## Layout and spacing

- 8pt grid (4pt for fine adjustments). Generous whitespace: sections 96-160px vertical padding on desktop, 56-80px on mobile.
- Max content width ~980-1120px for marketing, ~680-720px for reading. Center and let content breathe.
- Large corner radii, consistent per tier: 12px controls, 18-24px cards, 28-36px hero panels. Use continuous-feeling curves; avoid sharp corners mixed with round ones.
- Align to a clear grid; prefer one-column storytelling with occasional two- and three-up groupings.
- Touch targets at least 44x44px. Respect safe areas (`env(safe-area-inset-*)`) on mobile.

## Materials and depth

- Translucent "frosted" bars for sticky nav and toolbars: `background: rgba(255,255,255,.72); backdrop-filter: saturate(180%) blur(20px);` (dark: `rgba(22,22,23,.72)`). Add a 0.5px hairline border `rgba(0,0,0,.08)`.
- Shadows are soft and large-radius, low opacity (e.g. `0 8px 30px rgba(0,0,0,.08)`); never harsh or colored without reason.
- Provide an opaque fallback when `backdrop-filter` is unsupported or when `prefers-reduced-transparency` is set.

## Components

- **Buttons**: pill or 12px radius; primary = filled accent, secondary = tinted/plain text. Min height 44px, clear pressed state (slight scale `.98` / opacity drop).
- **Links**: accent color, no underline by default, underline on hover; "Learn more >" chevron pattern for secondary CTAs.
- **Navigation**: slim sticky bar, 44-48px tall, few items, frosted background.
- **Cards**: soft surface, no heavy borders, optional hairline; whole card is the hit target when it navigates.
- **Forms**: large inputs (44-52px), visible labels, inline validation, a clear focus ring (2px accent with 2px offset). Group in inset rounded containers.
- **Code and API examples**: rounded dark or light panel, mono font, copy button, real request/response samples only.
- **Icons**: consistent stroke weight (1.5-2px), SF Symbols-like geometry; prefer `lucide` or similar, never mix icon sets.

## Motion

- Purposeful and quick: 200-400ms, ease-out / spring-like curves (`cubic-bezier(.2,.8,.2,1)` or `cubic-bezier(.32,.72,0,1)`).
- Animate `transform` and `opacity` only; avoid layout-thrashing properties.
- Reveal-on-scroll should be subtle (8-16px translate + fade) and never hide content from no-JS or reduced-motion users.
- Always honor `@media (prefers-reduced-motion: reduce)` by removing non-essential motion.

## Accessibility (non-negotiable)

- Semantic HTML first; landmarks, one `h1`, logical heading order.
- Full keyboard operability and visible `:focus-visible` states.
- Do not convey meaning by color alone. Alt text for meaningful images, `aria-label` on icon-only buttons.
- Support zoom to 200%, `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`.

## Quality checklist

- [ ] One clear primary action per section
- [ ] Type scale limited; headline tracking tightened
- [ ] Single accent color; semantic colors used only for meaning
- [ ] 8pt spacing, consistent radii, generous whitespace
- [ ] Light and dark modes both checked for contrast
- [ ] Touch targets >= 44px; focus states visible
- [ ] Motion is subtle, transform/opacity only, reduced-motion respected
- [ ] No fabricated claims, logos, or Apple trademarks/assets
- [ ] Verified at mobile (375px), tablet, and desktop widths

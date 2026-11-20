---
name: Truthful Pro
description: A news-agency wire desk for a fact-checking API; cool newsprint, heavy ink rules, stamped verdict flags.
colors:
  newsprint: "#e3e7e9"
  newsprint-raised: "#eef1f2"
  wire-ink: "#12171b"
  wire-ink-soft: "#3d484f"
  stop-press-red: "#b82e17"
  verified-teal: "#0f6355"
typography:
  display:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(3.4rem, 8.5vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 4rem)"
    fontWeight: 900
    lineHeight: 0.95
  title:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 900
    lineHeight: 1
  body:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 900
    letterSpacing: "0.06em"
  payload:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  none: "0px"
spacing:
  gutter: "clamp(16px, 4vw, 56px)"
  gap-sm: "14px"
  gap-md: "32px"
  section: "clamp(56px, 9vw, 120px)"
components:
  button-primary:
    backgroundColor: "{colors.wire-ink}"
    textColor: "{colors.newsprint}"
    rounded: "{rounded.none}"
    padding: "0 26px"
    height: "52px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.stop-press-red}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.wire-ink}"
    rounded: "{rounded.none}"
    padding: "0 26px"
    height: "52px"
  button-ghost-hover:
    backgroundColor: "{colors.newsprint-raised}"
  button-invert:
    backgroundColor: "{colors.newsprint}"
    textColor: "{colors.wire-ink}"
    rounded: "{rounded.none}"
    padding: "0 26px"
    height: "52px"
  dispatch-panel:
    backgroundColor: "{colors.newsprint-raised}"
    textColor: "{colors.wire-ink}"
    rounded: "{rounded.none}"
    padding: "18px"
  flag-disputed:
    textColor: "{colors.stop-press-red}"
    rounded: "{rounded.none}"
    padding: "6px 12px 4px"
---

# Design System: Truthful Pro

## Overview

**Creative North Star: "The Wire Desk"**

The page is a dispatch coming off the machine, and a claim is checked the way an editor checks copy. Cool grey newsprint carries near-black ink; two stamp colors carry meaning and nothing else. Structure comes from heavy ink rules and ledger rows, never from cards, glows or rounded containers. It reads sober and exact, with the density of a newsroom rather than a dev-tool terminal.

Display type is condensed, uppercase and heavy, like a headline slug. Body is a book serif. Monospace appears only where actual payloads are shown. Motion is limited to the one thing a wire does: lines print in one by one.

**Key Characteristics:**
- Flat newsprint ground, 2px ink rules as the structural device
- Condensed uppercase display for headlines, flags, buttons and nav
- Red and teal are verdict signals, not decoration
- Square corners everywhere
- Ledger rows (rule-separated) instead of cards

## Colors

A two-ink newsprint palette: one paper, one ink, plus two reserved stamp colors.

### Primary
- **Stop-Press Red** (#b82e17): The DISPUTED verdict only (flag stamp, vocab word), plus the shared hover state on primary and inverse buttons, the focus ring, and the wordmark period.
- **Verified Teal** (#0f6355): The VERIFIED verdict word only.

### Neutral
- **Cool Newsprint** (#e3e7e9): Page ground, scrollbar track, inverse text.
- **Raised Newsprint** (#eef1f2): Dispatch panel and code blocks; the only tonal lift in the system.
- **Wire Ink** (#12171b): Text, all rules, primary button fill, panel header bar, closing section ground.
- **Soft Ink** (#3d484f): Lede, slug lines, descriptions, footer, secondary notes.

### Named Rules
**The Stamp Rule.** Red means disputed, teal means verified. Neither appears as general accent or decoration. (Red also marks interaction: hover on primary buttons and the focus ring, which is a state signal, not decoration.)

**The Two-Ink Rule.** Everything else is paper or ink. Hairlines are ink at 35% over the ground, not a separate grey.

## Typography

**Display Font:** Big Shoulders Display (Arial Narrow fallback), weights 700 and 900
**Body Font:** Source Serif 4 Variable (Georgia fallback)
**Label/Mono Font:** JetBrains Mono Variable

**Character:** A headline-slug condensed face against a bookish serif: the loud voice and the reading voice of a newspaper. Mono is the machine's voice.

### Hierarchy
- **Display** (900, clamp(3.4rem, 8.5vw, 6rem), 0.92): Hero headline, uppercase. One word may be set as an ink block (inverse highlight).
- **Headline** (900, clamp(2.6rem, 5vw, 4rem), 0.95): Section heading, uppercase; the closing headline scales up to 5.5rem.
- **Title** (900, 1.9rem, 1): Ledger row titles, uppercase. Verdict words in the vocabulary strip are 2rem at 0.08em tracking.
- **Body** (400, 1.125rem, 1.55): Serif prose, capped around 58ch in rows; the lede is 1.3rem at 34ch in soft ink.
- **Label** (900, 1.3rem, 0.06em, uppercase): Buttons. Nav is 700 at 1.15rem; slug lines 700 at 1rem and 0.1em.
- **Payload** (400, 0.86rem, 1.7): Request and response text, inline code samples.

### Named Rules
**The Payload-Only Mono Rule.** Monospace is for request and response text. Slug lines and flags use the condensed display face.

## Layout

A 1280px centered wrap with a fluid gutter (clamp(16px, 4vw, 56px)). The hero is a two-column grid (1fr / 1.05fr) with a headline-and-actions column beside the dispatch panel. Below: a three-column vocabulary strip between 2px rules, a split section with a sticky heading beside a ledger, and a full-bleed ink closing band. Section padding is generous and fluid (up to 120px). At 900px and below every grid collapses to one column, the sticky heading unpins, the vocabulary items stack with hairlines, and the nav keeps only the key button.

## Elevation & Depth

Flat by default. Depth is conveyed by 2px ink borders, ink-filled bars and the raised-paper tone. The single shadow is a diffuse ambient lift under the dispatch panel; nothing else casts one.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 6px 8px 18px rgba(18, 23, 27, 0.16)`): Dispatch panel only.

### Named Rules
**The Rule-Not-Shadow Rule.** Separation uses ink rules (2px structural, 1px hair). A shadow is reserved for the one object that is a physical dispatch.

## Shapes

Square. Radius is 0 everywhere; borders are full, 2px ink (3px on the verdict flag). The one gesture of geometry is the flag stamp rotated -2deg, like an inked stamp slightly off true.

## Components

### Buttons
- **Shape:** Square, 52px tall, 2px ink border, 0 26px padding, condensed uppercase 1.3rem.
- **Primary:** Ink fill, newsprint text.
- **Hover / Focus:** Primary and inverse buttons flip to stop-press red fill and border on hover; ghost gains raised newsprint. 160ms transitions on an expo-out ease; active presses down 1px. Focus is a 3px red outline at 3px offset (newsprint on the dark band).
- **Ghost:** Transparent, ink border. **Inverse / Line:** the closing band's paper fill and paper-bordered outline.

### Navigation
Masthead under a 2px ink rule: wordmark (900, uppercase, red period) left, condensed uppercase links right. Hover is an underline rule. The key link is a bordered button that inverts to ink on hover. Mobile keeps only that button.

### Dispatch Panel (signature)
A bordered raised-paper figure: ink header bar with two small mono caps labels (desk name, "Synthetic example"), request block, a 2px divider, then the response. Slug lines ("Request", "Dispatch") label each half. Response lines print in sequentially (520ms each, 260ms stagger) with a clip reveal; disabled under reduced motion. A footnote states the example is illustrative.

### Verdict Flag
Uppercase 1.6rem display text in a 3px red box, rotated -2deg. Verdict words in the vocabulary strip use the same type colored red, teal, or plain ink (unverifiable).

### Ledger Rows
Two-column rows (17ch title, body), separated by 1px hairlines inside a 2px top and bottom rule. Code samples sit in raised-paper blocks with a hairline border.

## Do's and Don'ts

### Do:
- **Do** use 2px ink rules to separate sections and 1px hairlines inside them.
- **Do** keep corners square and set headlines in uppercase Big Shoulders Display 900.
- **Do** reserve red for disputed and teal for verified; show unverifiable in plain ink.
- **Do** keep mono for payloads and label synthetic examples as such.
- **Do** gate entrance motion behind `prefers-reduced-motion: no-preference`.

### Don't:
- **Don't** use rounded cards, icon grids, gradients or glow; use ledger rows.
- **Don't** use red or teal as a decorative accent.
- **Don't** introduce a dark terminal treatment for the code; it sits on raised newsprint.
- **Don't** add shadows beyond the dispatch panel.

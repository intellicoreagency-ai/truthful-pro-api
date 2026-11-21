# TRUTHFUL PRO — approved mobile implementation contract

## Visual truth
- **Sapphire & gold** (owner decision, 2026-11-21) replaces the beige/ivory design: pearl pages `#F3F5F8`, frosted white glass cards, ink-navy text `#0E1526`, sapphire actions `#1D3A9E`, champagne gold `#D9BC7E` details, deep navy `#0A1430` hero wash. Tokens live in `src/theme.ts`.
- Approved service banner artwork keeps its own (warm) colours until replacement artwork in the new palette is approved.
- The old black/neon screens in the user-provided **مرجع .pdf** (42 pages) are references for **service content, structure, sequence and documents**, **not** the new page color scheme.
- Standardize banner/card sizes. **All 30 legacy banner images were rejected by the owner and removed from the Expo branch on 2026-11-18.** No previous service photo may be reused; the temporary brown/gold text surface is explicitly NOT an approved finished banner.
- Every replacement service banner must be a unique, accurately themed image consistent with the Sapphire & gold app. Arabic and English titles must be native text overlays, not baked into raster photographs.
- Keep the temporary text-first fallback until the full approved replacement set is imported and visually QA'd, then remove the quarantine guard in a separately reviewed commit.
- Arabic physical/layout reading direction RTL; English LTR. Back and forward navigation symbols mirror by language. Every control maintains consistent hit target and padding.
- Approved reference shows: Home > Services list > Detail with banner, tabs (service info / documents / fees), action grid, documents pick/remove, notes and sticky central plus. Other existing pages (account, request tracking, login) require their own bilingual implementation and review.
- Exact logo must be preserved; do not generate a replacement logo.

## Service data architecture
`src/services.ts`: 30 unique service IDs, 20 company and 10 individual.
`src/serviceDetails.ts`: one per-service structure with about, transactions, documents, notes, reference pages, content-review state and fee verification state.

Ref pages are PDF page indices, for example: labor pages 12/19, MOA page 4, company bank account page 5, commercial Ejari pages 6/11, RTA page 7, legal pages 8/20, FTA page 9, MOHRE establishment page 10, notary page 21, company setup page 22.
The source is a visual design reference and cannot be interpreted as binding government rules. Any case where the document doesn't specify correct requirements must remain marked `review-required`, without invented fees or promises of eligibility.

## Integration gating
- Expo UI is currently a preview. DocumentPicker selects files for local UI use only (PDF/JPG/PNG up to 5 MB, signature-checked, selected file removable).
- Do not upload customer files, make a real request, send OTP, collect payment or claim service authority before staging API contracts, security and official verification.
- `main` / staging / Cloudflare / production remain untouched until owner authorizes deployment.


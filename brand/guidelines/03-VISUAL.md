# 03 — Visual

> **Version** 0.1 · **Date** 2026-10-06 · **Status** DRAFT ◐. Sources: the owner's direction of 2026-10-06; CapWatch intracalc `brand/guidelines/03` (§6 type, §9 layout, §11a corporate mark); `frontend-system/packages/tokens/tokens.json`; `intracalc-web/app/globals.css` `[data-site]`. Live values are in `../site/assets/css/site.css`; where this file disagrees with the tokens, the tokens win.

## 1. Immutables (proposed for the decade)

1. **Ink on paper.** White ground, black ink, greys in between. No brand colour. ✅ *(owner, 2026-10-06: "our website is mainly white and black")*
2. **The page is a drawing sheet**: a grey micro-grid, rails, hairlines, `+` marks and L-corners (§4). The grid is never blue. ✅ *(owner: "blueprint like microgrid (not blue color)")*
3. **One drawing language and one theatre**: ASCII figures, and the scroll theatre that morphs them (`09`).
4. **CapWatch's type and grid, verbatim.** Nothing above Medium 500.
5. **Product marks appear only as their own masters, on their own ground** (`01` §3).

## 2. Colour

| Role | Light (the default) | Dark (full-viewport sections) |
|---|---|---|
| Ground | `#ffffff` (`--bg`), `#fafafa` (`--bg-2`) | `#000000` |
| Ink | `#0a0a0a` · `#404040` · `#737373` · `#a3a3a3` · `#d4d4d4` (`--ink-1…5`) | `#fafafa` · `#d4d4d4` · `#a3a3a3` · `#737373` |
| Lines | `#e5e5e5` hairline, `#d4d4d4` strong | `#1f1f1f`, `#3d3d3d` |
| Grid | minor `rgba(10,10,10,.045)`, major `rgba(10,10,10,.08)` | `#fafafa` at the same strengths |

- The dark palette is capwatch.in's (`globals.css` `[data-site]`, quoted from `tokens.json` › dark).
- **No accent** ◐. Links are ink with a 1 px underline at a 3 px offset. Focus is a 2 px `--ink-1` outline, 3 px offset. Selection is ink ground with white text. Link blue stays CapWatch's.
- **Emphasis by weight or position, never by colour** (CapWatch `03` §6).

## 3. Type

- **Faces:** Instrument Sans (variable, used at 400 and 500 only) and DM Mono (400, 500). Both are self-hosted woff2 under SIL OFL 1.1. Never Google Fonts, never a system fallback in production.
- **Scale** (`tokens.json` › typography.web):

  | Style | Size / line |
  |---|---|
  | caption-2 (mono) | 10/14 |
  | caption-1 (mono) | 12/16 |
  | body-1 | 14/20 |
  | subtitle-1 | 16/22 |
  | title-3 | 20/28 |
  | title-2 | 24/32 |
  | title-1 | 28/36 |
  | title-large | 40/52 |
  | display | 48/60 |

  One hero step above display, at most 72 px, is allowed via `clamp()` ◐.
- **Weight:** never above 500. ✅ *(owner, 2026-09-17)*
- **Discipline (Müller-Brockmann):** left-aligned, ragged right, no italics, tracking only on the wordmark, tabular numerals in mono. Mono carries figures, captions, FIG. labels and annotations. Uppercase only for FIG. labels and zone letters.

## 4. The sheet

These are the page's structural lines. Each one marks structure, never decoration ◐.

| Element | Spec |
|---|---|
| Micro-grid | Minor every 8 px, major every 40 px, 1 CSS px lines at the §2 strengths. A `+` (4 px arms) sits at each major crossing. It is faded by masks, so it never reaches full strength under running text. |
| Rails | Two vertical hairlines (`--line`) at the container's edges (max 1360 px; margins 20 / 32 / 40 px at < 640 / 640 / 1024), running the full page. |
| Section lines | Full-bleed horizontal hairlines (`--line`) between sections. |
| `+` marks | Where a rail crosses a section line: 9 × 9 px, 1 px stroke, `--ink-4`, centred on the crossing pixel. |
| L-corners | Four brackets on a framed element. Arm 12 px (10 px under 640), stroke 1 px, `--ink-1` on figures and the title block, `--ink-4` on a card set. The bracket's outer edge sits on the frame's outer edge, with no gap and no overhang. Over a hairline border it overlays the same pixel row, so the corner reads as the border's darkened end. |

- **Crisp, always.** Lines are snapped to whole CSS pixels. Never use sub-pixel positions, transforms or rotated elements to draw a line. Never draw them with images. One arm length per breakpoint, site-wide.
- **Restraint.** L-corners mark a *figure* or a *record*: the theatre plate, the company title block, one card set. They never go on every box. Brackets that drift, vary or crowd the page are what made the earlier attempt read poorly.
- **Annotations:** DM Mono caption-1/2, sparse. FIG. label in a corner, a readout, zone letters at the most. Furniture, not text to be read (CapWatch `09` §4.4).

## 5. The corporate mark

| | |
|---|---|
| Master | Diamond-R lettermark plus the two-line wordmark REALITY REACH / TECHNOLOGIES, 295 × 78. A steel gradient of four greys (`#7D7D7D` → `#D1D1D1`), drawn for dark ground (CapWatch `03` §11a). Copy at `../assets/marks/logo-reality-reach.svg`. |
| On dark ground | the steel master, unaltered |
| On white | the steel master itself, inlined in the page (owner, 2026-10-06: the steel gradient everywhere, never a flat recolour). ⬜ Its legibility at header size is `OPEN-QUESTIONS` Q1. |
| Lettermark alone | header under 640 px, favicon, avatar ◐ |
| Clear space | 0.25 × lettermark height on every side (CapWatch value carried) ◐ |
| Minimum | lettermark 16 px / 6 mm; full lockup 20 px high on screen (the capwatch.in header size) ◐ |
| Never | Recolour to a hue, outline, shadow, rotate, redraw, or retype the wordmark. Never place it beside a product mark at parity. In ASCII it appears only as FIG. 04 (`09` §3). |

## 6. Dark sections

- Full viewport, `#000000`, the capwatch.in palette.
- Used for a product feature, or for one deliberate chapter break ◐.
- Inside a product feature the product's world rules: no house grid, no ASCII, no house mark. The edges are hard, with no gradient fade.

## 7. Imagery

- No stock photography, no stock video, no illustrations of people.
- Figures are ASCII (`09`).
- Founders appear by name, and in photographs only with their consent (decadal L05) ⬜.
- Retired with the old site: the stock product photographs, the background video, and the "Built with ♦" line.

## 8. Forbidden

A blue grid. Bold. A brand colour. Gradients on type. Glows, shadows, glass cards. Stock imagery. Emoji. A product mark at parity with the house mark. A product mark in ASCII. Scroll-jacking: the theatre uses native scroll and a sticky stage, never wheel capture or snapping. Corner brackets on everything.

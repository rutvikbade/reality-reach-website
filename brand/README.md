# Reality Reach — the brand department

> **Version** 0.1 · **Date** 2026-10-06 · **Status** DRAFT. Generated from the owner's direction of 2026-10-06 (quoted in [DECISIONS.md](./DECISIONS.md)). Nothing here is law until the owner rules.
> Markers: ✅ ruled *(owner, date)* · ◐ grounded recommendation · ⬜ the owner's to decide.

**This directory owns the meaning and law of Reality Reach**: Reality Reach Technologies LLP as a brand, and the parent of CapWatch. It adopts CapWatch's department (intracalc `brand/`) instead of reinventing it, in the owner's words: "the brand, guidelines, voice, etc are almost similar to capwatch, RR is the parent, capwatch is specific product brand". It is also one organisation's instance of the decadal brand department (intracalc `decade-departments/brand/`, laws L01–L16).

```
seed/ (owner; not yet written)  →  guidelines/ (law, generated)  →  ../site/ and collateral (derived)
```

There is no `seed/` yet, because agents never write one. Until the owner authors it, the dated owner direction in `DECISIONS.md` stands in for it. Proposed seed items are at the end of `OPEN-QUESTIONS.md`.

## Quick navigation

| Document | Purpose |
|---|---|
| [DECISIONS.md](./DECISIONS.md) | Rulings log. Read first: it holds the owner's own words. |
| [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) | Owner questions, each with a recommended answer, plus the proposed seed items. |
| [guidelines/01-ARCHITECTURE.md](./guidelines/01-ARCHITECTURE.md) | The house and its products in both directions; the disclosure ladder; names; the entity block; addresses; mail hygiene. |
| [guidelines/03-VISUAL.md](./guidelines/03-VISUAL.md) | White and black; the sheet (micro-grid, rails, hairlines, `+` marks, L-corners); type; the corporate mark; dark sections. |
| [guidelines/04-VOICE.md](./guidelines/04-VOICE.md) | The corporate register, positioning, the subliminal thesis, words, patterns, the check. |
| [guidelines/09-ASCII-WORLD.md](./guidelines/09-ASCII-WORLD.md) | The drawing language: what ASCII means here, guardrails, the figure registry FIG. 01–04, glyphs, motion, media, pipeline. |
| [assets/README.md](./assets/README.md) | Masters and their provenance. |
| `../site/` | realityreach.com, a derived surface. It is built to this law but not owned by this folder. |

Numbering follows CapWatch's, so the same reader finds the same law in the same place: 01 ↔ 01, 03 ↔ 03, 04 ↔ 04, 09 ↔ 09. The gaps are deliberate. 02 inventory is folded in below. 06 patterns and 08 trees will come when a second surface (deck, letterhead) needs them.

## Inherited, adapted, new

| Concern | CapWatch source | Reality Reach |
|---|---|---|
| Typefaces | Instrument Sans, DM Mono 400/500 (`03` §6) | verbatim |
| Type scale, 4 px spacing, 1/6/12 grid, margins, 1360 container | `frontend-system/packages/tokens/tokens.json`; `03` §9; `intracalc-web/app/globals.css` `[data-site]` | verbatim |
| Never above Medium 500 | owner 2026-09-17 (memory: site taste rulings) | verbatim |
| Register | `04` (declarative, specific, restrained with rhythm, impersonal, honest, crafted) | verbatim. The reader becomes the counterpart (`04` §1). |
| Ground | dark-only web | **light**: white and black with a grey micro-grid, plus full-viewport dark sections ✅ *(owner, 2026-10-06)* |
| Accent | link blue | none; black and white only ◐ (`03` §2) |
| The world | horology, plates FIG. 1–6 (`09`) | ASCII figures FIG. 01–04 (`09`) |
| Theatre | the living rotor, apps only | the ASCII scroll theatre, site only ◐ |
| Mark | the reversed watch | the diamond-R lettermark with the two-line wordmark (`03` §5) |
| Legal person | the LLP as attribution (`03` §11a, `06` P13) | the LLP *is* the house; entity block per LLP Act s.21 (`01` §6) |
| Rights | `brand/legal/` (CapWatch marks) | the RR marks are unfiled ⬜ (trade-mark roadmap) |

## What exists (inventory, 2026-10-06)

| Asset or surface | Where | State |
|---|---|---|
| Corporate mark master: steel, for dark ground, 295 × 78 | `assets/marks/logo-reality-reach.svg`, a byte-identical copy of the intracalc iOS master | ✅ exists |
| Screen rendition | the steel master, inlined in `../site/index.html` (owner: steel everywhere) | ✅ in use; header legibility is `OPEN-QUESTIONS` Q1 |
| Print rendition of the mark | — | ⬜ missing |
| ASCII figures FIG. 01–04 | `../site/assets/js/ascii.js` (computed) | ◐ in build; the code is the source of truth |
| Figure masters (txt/svg/png) | — | ⬜ generator not built (`09` §10) |
| Corporate letterhead (CapWatch `06` P10a) | template with a placeholder mark | ⬜ needs the print rendition |
| realityreach.com (live) | Firebase Hosting, project `reality-reach` (inferred from DNS TXT) | a placeholder: no policies, no s.21 statement, stock-style copy. Replaced by `../site/` when the owner pushes. |
| Old site files in this repo | git history only (commit `dfcda16`) | ✅ deleted *(owner, 2026-10-06)* |
| LinkedIn, Instagram | public | not audited |

## For AI agents

1. Read `DECISIONS.md`, then the guideline for your concern.
2. **Copy:** follow `04`, then run the grep in `04` §8 before presenting.
3. **Figures:** follow `09`. Never render a product mark in ASCII.
4. **Values:** quote `../site/assets/css/site.css`, which quotes CapWatch `tokens.json`. Never quote from memory.
5. **Never** commit, deploy, write `seed/`, or name undisclosed work (`01` §4).

## Ownership

- **The owner authors** the seed (when written), every ⬜ item, and the masters.
- **Generated, then the owner reviews:** `guidelines/`, `DECISIONS.md` entries marked ◐, and `OPEN-QUESTIONS.md`.
- **Derived surfaces:** `../site/`, and decks and paper when they exist.

Regenerate; never hand-patch. A rule changes only by a dated entry in `DECISIONS.md` (decadal L16).

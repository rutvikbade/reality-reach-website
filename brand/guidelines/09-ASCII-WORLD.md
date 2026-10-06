# 09 — The ASCII World

> **Version** 0.1 · **Date** 2026-10-06 · **Status** DRAFT ◐. The owner's direction of 2026-10-06: "how svg watch component animations were the 'thing' for capwatch website, for RR website it should be ascii animations, storytelling, virtue, inception, subliminal". Structure follows CapWatch intracalc `brand/guidelines/09-HOROLOGICAL-WORLD.md`. The code in `../site/assets/js/ascii.js` is the geometry's source of truth.

## 1. What the world is

ASCII is the raw material of computation: the 95 printable characters every machine has shared since 1963. Arranged with craft, they become figures people recognise: two people agreeing, a planet turning, a structure rising.

That is what Reality Reach does. It takes the plain material of software and builds things that are real and relied on. The figures make *reach* visible: characters reaching into the shape of the real. The world plays the role for the house that horology plays for CapWatch. It is a source of meaning, not a filter effect.

## 2. Four guardrails

Every use passes all four.

1. **Truth.** A figure never implies a client, project, office, place, scale or capability that is not real. The globe pins nothing. The crane depicts no named project. No figure stands for undisclosed work (`01` §4).
2. **Craft.** Figures are computed, never traced. Photographs and third-party art are never converted to ASCII; public-domain geodata may feed a computed figure (FIG. 02: Natural Earth coasts and boundaries, NASA relief as the land's tone). *Wish You Were Here* is an emotional reference only: the figures are original and there is no fire. Glyphs are edge-aware, on one cell grid, in one face (DM Mono).
3. **Restraint.** One figure per view, one meaning per figure. No FIGlet lettering of words. No terminal cosplay: no green on black, no CRT scanlines, no blinking-cursor clichés.
4. **Marks.** A mark is never rendered in ASCII: not CapWatch's caseback, not a store badge, not a client's logo, and not the house lettermark (owner, 2026-10-06: the ASCII-mark chapter was removed; the theatre is three figures).
5. **India's boundary.** Wherever India is drawn it is drawn in its official boundary (Natural Earth, India point of view), never another view.

## 3. The registry

| FIG. | Name | The figure | One meaning | Where |
|---|---|---|---|---|
| 01 | Partnership | after the album cover, drawn new: two men in dark suits walk in across an open lot, low studio buildings on the horizon; scroll walks them, they meet, shake (a firm pump) and hold | Every enduring thing begins with the right counterpart. | theatre chapter 0 |
| 02 | The decade | the world, India facing: coasts drawn as lines, land toned by relief, India a step darker, dotted graticule, routes leaving India, two orbits | The world is being redrawn. | theatre chapter 1 |
| 03 | The work | a tower crane (lattice mast, jib, counter-jib, trolley, hook holding the next section) beside a skyscraper rising floor by floor with the scroll | What comes next has to be built, physical and digital. | theatre chapter 2 |
| 04 | A seat at the table | a man seated at a meeting table; the chair opposite empty and turned out | An invitation. | the Contact section |
| — | Field | a sparse ambient glyph field | Nothing; it is ground texture only. | behind sections, faint, never under text ◐ |

**FIG. 02's land** is real: Natural Earth 1:50m land at 0.75° (public domain), NASA Blue Marble Next Generation relief at 1.5° for the land's tone (public domain, courtesy of NASA Visible Earth), India from Natural Earth 1:10m, India point of view. Never a near-Earth fake. The rest pose faces India (where the house is).

A new figure, or a new meaning for an old one, is a dated entry in `DECISIONS.md`.

## 4. Glyphs

- **Printable ASCII only (32–126)** ◐, so every frame reproduces in any terminal, plain-text mail or print without a font dependency.
- **Ramp, light to dense on white** (2026-10-06): `·.:;=+ico2ZQ#` after the space, ordered at run time by measured DM Mono coverage. Thirteen steps, so a flat tone prints as a calm run of one glyph (the asciigen look); the full printable set was tried and read as noise.
- **Edge glyphs**, chosen by gradient angle once the gradient's magnitude crosses a threshold:
  - `-` and `_` for horizontal edges;
  - `|` for vertical edges;
  - `/` and `\` for diagonals.

  This is what makes a figure read as drawn rather than converted. A coast (land beside sea) takes the same strokes.
- **Scramble set** (the decode moment while morphing): punctuation from the same range, for example `!#$%&*+/<=>?@[]^{|}~`.
- **Ink:** two at most. `--ink-1` for dense and edge glyphs, `--ink-3` or `--ink-4` for sparse ones. On dark ground the same tokens resolve to light ink.
- **Cell:** DM Mono, advance about 0.6 em, line about 1.2 em. One cell size per figure, scaled to the stage.

## 5. Drafting conventions and placement

- **The plate.** A figure sits in an L-cornered frame (`03` §4). `FIG. 0n — NAME` sits in a corner in mono caption, with an optional live readout. One plate per view.
- **A figure has its own space.** Type sits beside it or below it, never over dense glyphs.
- **Never behind** the entity block, legal lines, prices, the mark, or a product feature. The CapWatch section is horology's world and carries no ASCII.
- **Minimum:** 48 × 24 cells ◐. Below that a figure turns to noise, so use the field or nothing. On phones the figure takes about the top half of the stage and the caption takes the rest.

## 6. Motion

- **Morph:** scrubbed by native scroll on a sticky stage, never by wheel capture or snapping. Each chapter holds its figure for about its first 55%. The handover is a dissolve: a per-cell noisy threshold plus a directional sweep, with the scramble set at the boundary.
- **Idle:** slow and physically true.
  - Globe: about one turn every 40–60 s.
  - Hook: swings at the pendulum period for its cable length.
  - Handshake: at most one cell of movement.
- **Off screen:** paused. **Reduced motion:** no idle loops, and scroll changes apply without the dissolve.
- **Budget:** 4 ms or less per frame on a mid-range phone. DPR-aware canvas, glyph atlas, no layout work per frame.

## 7. By medium

| Medium | Carries | Rule |
|---|---|---|
| Web | the theatre (FIG. 01–04), FIG. 01 at Contact | as §5–6 |
| Link preview / OG | interim: a typographic card, no figure; final: a FIG. 01 rest frame with the lockup | ⬜ owner (`OPEN-QUESTIONS` Q3) |
| Deck | one figure per section opener, as live mono text or outlined glyphs | white ground; no motion in the file |
| Social | a single frame, or a 6–10 s loop of one figure, with one line in Instrument Sans | never the avatar |
| Video | the theatre rendered as film, ending on FIG. 04, then the lockup on flat ground | ⬜ |
| Print | glyphs as live DM Mono or outlined; black ink only; glyph 6 pt or larger | never on paper of money and law (CapWatch `06` P10a) |
| Email | none | |

## 8. Pipeline

- **Source of truth:** the scenes in `../site/assets/js/ascii.js`, which are computed. Frames are never hand-edited.
- ⬜ **Not built yet:** a generator that renders each figure at its rest pose to `assets/figures/`. Output would be `.txt` (the characters), `.svg` (as text and outlined), `.png` at 1200 and 2400 on white and on black, and a manifest holding the source's SHA-256 for drift detection. This is the pattern of CapWatch's `scripts/brand/gen-plates.mjs`. Build it when a second medium (deck, OG, print) needs a figure.


/* ════════════════════════════════════════════════════════════════════════
   chess.js — R.2 The second half.

   Scroll through the track drives one number, the section's progress (0 … 1).
   It is written onto the plate's canvas (`data-p`, read by the ASCII engine)
   and into the beats, the readouts and the ruler:

     0.00–0.40  01 First half    squares 1 … 32   1950–2025
     0.40–0.62  02 The turn      square 33        2026
     0.62–1.00  03 Second half   squares 34 … 64  2027–2050

   With reduced motion each beat holds its final frame: no growth, no camera
   travel, the beats change as whole steps. No dependencies.
   ════════════════════════════════════════════════════════════════════════ */

import { squareAt } from "./ascii/chess-scene.js";
import { wake } from "./ascii/theatre.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const BEATS = [
  { name: "First half", span: "first half", years: "1950–2025", end: 0.4 },
  { name: "The turn", span: "the turn", years: "2026", end: 0.62 },
  { name: "Second half", span: "second half", years: "2027–2050", end: 1 },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The ruler's year for a square: 1950 … 2025 across the first half, 2026 at the turn, 2050 at the last square. */
function yearAt(sq) {
  if (sq <= 32) return 1950 + ((sq - 1) * 75) / 31;
  if (sq <= 33) return 2025 + (sq - 32);
  return 2026 + ((sq - 33) * 24) / 31;
}

/** Where a year sits on the ruler: four evenly spaced marks, 1950 · 2026 · 2036 · 2050. */
function rulerX(y) {
  if (y <= 2026) return ((y - 1950) / 76) / 3;
  if (y <= 2036) return 1 / 3 + ((y - 2026) / 10) / 3;
  return 2 / 3 + ((Math.min(y, 2050) - 2036) / 14) / 3;
}

function setup(section) {
  const track = section.querySelector("[data-chs-track]");
  const canvas = section.querySelector('canvas[data-ascii="chess"]');
  if (!track || !canvas) return;
  const beats = [...section.querySelectorAll(".chs-beats > li[data-beat]")];
  const figures = [...section.querySelectorAll(".chs-figure[data-beat]")];
  const ticks = [...section.querySelectorAll("[data-tick-beat]")];
  const out = {
    square: section.querySelector("[data-chs-square]"),
    span: section.querySelector("[data-chs-span]"),
    year: section.querySelector("[data-chs-year]"),
    years: section.querySelector("[data-chs-years]"),
    figure: section.querySelector("[data-chs-figure]"),
    progress: section.querySelector("[data-chs-progress]"),
    fill: section.querySelector("[data-chs-fill]"),
    marker: section.querySelector("[data-chs-marker]"),
  };
  const shown = { beat: -1, square: "", year: "", progress: "", x: "", p: "" };
  let raf = 0;

  const text = (el, key, v) => {
    if (el && shown[key] !== v) {
      el.textContent = v;
      shown[key] = v;
    }
  };

  const update = () => {
    raf = 0;
    const r = track.getBoundingClientRect();
    const span = Math.max(1, r.height - window.innerHeight);
    const raw = clamp01(-r.top / span);
    const beat = raw < BEATS[0].end ? 0 : raw < BEATS[1].end ? 1 : 2;
    const p = reduced.matches ? BEATS[beat].end : raw;
    const sq = squareAt(p);

    // The plate.
    const pv = p.toFixed(4);
    if (shown.p !== pv) {
      canvas.dataset.p = pv;
      shown.p = pv;
      const plate = canvas.__plate;
      if (plate) {
        plate.dirty = true;
        wake();
      }
    }

    // The beat.
    if (shown.beat !== beat) {
      shown.beat = beat;
      for (const el of [...beats, ...figures]) {
        const on = Number(el.dataset.beat) === beat;
        el.toggleAttribute("data-active", on);
        // A beat that is not on screen keeps its links out of the keyboard order.
        for (const a of el.querySelectorAll("a[href]")) {
          if (on) a.removeAttribute("tabindex");
          else a.setAttribute("tabindex", "-1");
        }
      }
      for (const t of ticks) t.toggleAttribute("data-on", Number(t.dataset.tickBeat) === beat);
      text(out.span, "spanText", BEATS[beat].span);
      text(out.years, "yearsText", BEATS[beat].years);
      text(out.figure, "figureText", "FIG. R.2 — " + BEATS[beat].name);
    }

    // The readouts.
    // The turn reads as square 33, 2026, from its first frame.
    const n = beat === 1 ? 33 : Math.max(1, Math.min(64, Math.floor(sq + 1e-6)));
    text(out.square, "square", String(n));
    const y = beat === 1 ? 2026 : yearAt(sq);
    text(out.year, "year", String(Math.floor(y + 1e-6)));
    text(out.progress, "progress", sq.toFixed(2).padStart(5, "0"));
    const x = rulerX(y).toFixed(4);
    if (shown.x !== x) {
      shown.x = x;
      out.fill?.style.setProperty("--x", x);
      out.marker?.style.setProperty("--x", x);
    }
  };

  const request = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  reduced.addEventListener?.("change", request);
  // The engine mounts the plate after the font loads; draw the right moment then.
  if (!document.documentElement.hasAttribute("data-ascii-ready")) {
    const mo = new MutationObserver(() => {
      if (document.documentElement.hasAttribute("data-ascii-ready")) {
        mo.disconnect();
        shown.p = "";
        request();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ascii-ready"] });
  }
  update();
}

document.querySelectorAll("[data-chess]").forEach(setup);

// A footnote opens the sources before the browser scrolls to the entry.
const sources = document.getElementById("chs-sources");
if (sources) {
  const open = (id) => {
    if (id && id.startsWith("chs-src-")) sources.open = true;
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.('a[href^="#chs-src-"]');
    if (a) open(a.getAttribute("href").slice(1));
  });
  window.addEventListener("hashchange", () => open(location.hash.slice(1)));
  if (location.hash.startsWith("#chs-src-")) {
    open(location.hash.slice(1));
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }
}

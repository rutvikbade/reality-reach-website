/**
 * realityreach.com — the ASCII plates.
 *
 * Mounts every `canvas.ascii[data-ascii]` on the page:
 * - `data-ascii="theatre"` inside a `[data-theatre]` section is the scroll story
 *   (DOM contract: scratchpad CONTRACT.md, bench kept outside the shipped site).
 * - any other value names one figure: partnership · decade · work · table
 *   (older names handshake · globe · crane still resolve).
 * Optional `data-ascii-font="9"` fixes the type size; `data-scenes` on the
 * theatre section reorders its figures.
 *
 * `?p=<0..chapters>` pins the theatre's progress and stills every plate, for
 * screenshots (past chapters − 1 it raises the last figure's floors); `?t=<seconds>` stills the clock at a moment;
 * `?ascii-perf` exposes frame timings on `window.__asciiPerf`.
 */

import { prepareFont } from "./ascii/engine.js";
import { Plate, Theatre, wake } from "./ascii/theatre.js";

async function boot() {
  await prepareFont();
  for (const section of document.querySelectorAll("[data-theatre]")) {
    const canvas = section.querySelector('canvas[data-ascii="theatre"]');
    if (canvas && !canvas.__plate) new Theatre(section, canvas);
  }
  for (const canvas of document.querySelectorAll("canvas[data-ascii]")) {
    if (canvas.__plate || canvas.dataset.ascii === "theatre") continue;
    new Plate(canvas, canvas.dataset.ascii);
  }
  document.documentElement.setAttribute("data-ascii-ready", "");
  wake();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();

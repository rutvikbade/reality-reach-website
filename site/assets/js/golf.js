/* ════════════════════════════════════════════════════════════════════════
   golf.js — Contact · FIG. 04 The long game.

   Scroll through the section drives one number, the story's moment (0 … 1):
   the swing, the ball's flight, the walk, the handshake. It is written onto
   the plate's canvas (`data-p`, read by the ASCII engine) and the readout.

   With reduced motion the story shows its key frames: address, the top, the
   finish, the meeting, the handshake. `?g=<0..1>` pins the moment (for
   screenshots). No dependencies.
   ════════════════════════════════════════════════════════════════════════ */

import { wake } from "./ascii/theatre.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const params = new URLSearchParams(window.location.search);
const pinned = params.has("g") ? parseFloat(params.get("g")) : null;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Key frames for reduced motion, each held across its share of the scroll. */
const KEYS = [
  [0.18, 0],
  [0.38, 0.31],
  [0.6, 0.5],
  [0.82, 0.8],
  [1.01, 1],
];

function setup(section) {
  const canvas = section.querySelector('canvas[data-ascii="golf"]');
  if (!canvas) return;
  const readout = section.querySelector("[data-golf-readout]");
  let shown = "";
  let raf = 0;

  const update = () => {
    raf = 0;
    let u;
    if (pinned !== null && Number.isFinite(pinned)) u = clamp01(pinned);
    else {
      const r = section.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      u = clamp01(-r.top / span);
    }
    if (reduced.matches) u = KEYS.find((k) => u < k[0])[1];
    const v = u.toFixed(4);
    if (v === shown) return;
    shown = v;
    canvas.dataset.p = v;
    if (readout) readout.textContent = (u * 100).toFixed(2).padStart(5, "0");
    const plate = canvas.__plate;
    if (plate) {
      plate.dirty = true;
      wake();
    }
  };
  const request = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  reduced.addEventListener?.("change", () => {
    shown = "";
    request();
  });
  // The engine mounts the plate once the font is ready; draw the right moment then.
  if (!document.documentElement.hasAttribute("data-ascii-ready")) {
    const mo = new MutationObserver(() => {
      if (document.documentElement.hasAttribute("data-ascii-ready")) {
        mo.disconnect();
        shown = "";
        request();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ascii-ready"] });
  }
  update();
}

document.querySelectorAll("[data-golf]").forEach(setup);

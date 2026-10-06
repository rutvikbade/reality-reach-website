/**
 * The capital donut — capwatch.in's hero instrument, drawn here with the same
 * recipe (intracalc-web › components/site/live-capital-donut.tsx).
 *
 * The markup is the resting state: every slice drawn, every value in the
 * legend. This module draws the ring in when it is first seen, then reads the
 * slices in turn — the hole shows the amount and share, the slice lifts, the
 * legend follows — and returns to the whole. A visitor's hover, focus or tap
 * takes over from the loop. Off screen it stops; with reduced motion it rests
 * on the whole. The figures are illustrative, never a customer's.
 */

const C = 120;
const OUTER = 96;
const INNER = 56;
const LIFT = 5;
const DRAW_MS = 1400;
const DWELL_WHOLE = 2600;
const DWELL_SLICE = 2300;
const HOLD_AFTER_TOUCH = 6000;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

const f3 = (n) => (Math.round(n * 1000) / 1000).toString();
function arc(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r];
}
function slicePath(s, e) {
  const L = e - s > 180 ? 1 : 0;
  const [x1, y1] = arc(OUTER, s);
  const [x2, y2] = arc(OUTER, e);
  const [x3, y3] = arc(INNER, e);
  const [x4, y4] = arc(INNER, s);
  return `M${f3(x1)},${f3(y1)} A${OUTER},${OUTER} 0 ${L} 1 ${f3(x2)},${f3(y2)} L${f3(x3)},${f3(y3)} A${INNER},${INNER} 0 ${L} 0 ${f3(x4)},${f3(y4)} Z`;
}
function edgePaths(s, e) {
  const L = e - s > 180 ? 1 : 0;
  const [ox1, oy1] = arc(OUTER, s);
  const [ox2, oy2] = arc(OUTER, e);
  const [ix1, iy1] = arc(INNER, s);
  const [ix2, iy2] = arc(INNER, e);
  return [
    `M${f3(ox1)},${f3(oy1)} A${OUTER},${OUTER} 0 ${L} 1 ${f3(ox2)},${f3(oy2)}`,
    `M${f3(ix1)},${f3(iy1)} A${INNER},${INNER} 0 ${L} 1 ${f3(ix2)},${f3(iy2)}`,
    `M${f3(ix1)},${f3(iy1)} L${f3(ox1)},${f3(oy1)}`,
    `M${f3(ix2)},${f3(iy2)} L${f3(ox2)},${f3(oy2)}`,
  ].join(" ");
}
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
function tween(from, to, duration, onFrame) {
  let raf = 0;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    onFrame(from + (to - from) * easeOutCubic(t));
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

class Donut {
  constructor(root) {
    this.root = root;
    this.total = root.dataset.total || "";
    this.caption = root.dataset.caption || "";
    this.readout = root.querySelector("[data-donut-readout]");
    this.slices = [...root.querySelectorAll(".donut__slice")].map((g) => ({
      g,
      before: parseFloat(g.dataset.before),
      share: parseFloat(g.dataset.share),
      glow: g.querySelector(".donut__glow"),
      fill: g.querySelector(".donut__fill"),
      dots: g.querySelector(".donut__dots"),
      edge: g.querySelector(".donut__edge"),
    }));
    this.legend = root.querySelector("[data-donut-legend]");
    this.buttons = this.legend ? [...this.legend.querySelectorAll("button[data-slice]")] : [];
    this.active = null;
    this.touched = false;
    this.drawn = reduced.matches;
    this.inView = false;
    this.timer = 0;
    this.cancelDraw = null;

    const choose = (i) => {
      this.touched = true;
      this.setActive(i);
    };
    this.slices.forEach((s, i) => {
      s.g.addEventListener("pointerenter", () => choose(i));
      s.g.addEventListener("pointerleave", () => choose(null));
    });
    this.buttons.forEach((b, i) => {
      b.addEventListener("pointerenter", () => choose(i));
      b.addEventListener("pointerleave", () => choose(null));
      b.addEventListener("focus", () => choose(i));
      b.addEventListener("blur", () => choose(null));
      b.addEventListener("click", () => choose(this.active === i ? null : i));
    });

    // Drawn in only when seen; collapsed until then (the section sits far
    // below the fold, so the resting markup is never seen collapsing).
    if (!this.drawn) this.layout(0);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        this.inView = entry.isIntersecting;
        this.inView ? this.wake() : this.sleep();
      },
      { rootMargin: "-10% 0px" }
    );
    io.observe(root);
    reduced.addEventListener("change", () => {
      if (reduced.matches) {
        this.sleep();
        this.cancelDraw?.();
        this.layout(1);
        this.drawn = true;
      }
    });
  }

  /** Lays the ring out at a share of its full sweep, 0 to 1. */
  layout(progress) {
    for (const s of this.slices) {
      const start = -90 + s.before * 3.6 * progress;
      const sweep = s.share * 3.6 * progress;
      if (sweep < 0.2) {
        s.g.style.display = "none";
        continue;
      }
      s.g.style.display = "";
      const end = start + sweep;
      const edges = edgePaths(start, end);
      const body = slicePath(start, end);
      s.glow.setAttribute("d", edges);
      s.edge.setAttribute("d", edges);
      s.fill.setAttribute("d", body);
      s.dots.setAttribute("d", body);
    }
  }

  wake() {
    if (reduced.matches) return;
    if (!this.drawn) {
      this.cancelDraw = tween(0, 1, DRAW_MS, (p) => {
        this.layout(p);
        if (p >= 1) {
          this.drawn = true;
          this.cancelDraw = null;
          this.loop();
        }
      });
      return;
    }
    this.loop();
  }

  sleep() {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  /** Reads the slices in turn, then the whole, while on screen. */
  loop() {
    clearTimeout(this.timer);
    const sequence = [null, ...this.slices.map((_, i) => i)];
    let cursor = this.active === null ? 0 : sequence.indexOf(this.active);
    let holdUntil = 0;
    const advance = () => {
      if (!this.inView) return;
      if (this.touched) {
        this.touched = false;
        holdUntil = Date.now() + HOLD_AFTER_TOUCH;
      }
      if (Date.now() < holdUntil) {
        this.timer = setTimeout(advance, 800);
        return;
      }
      cursor = (cursor + 1) % sequence.length;
      const next = sequence[cursor];
      this.setActive(next);
      this.timer = setTimeout(advance, next === null ? DWELL_WHOLE : DWELL_SLICE);
    };
    this.timer = setTimeout(advance, this.active === null ? DWELL_WHOLE : DWELL_SLICE);
  }

  setActive(index) {
    if (index === this.active) return;
    this.active = index;
    this.slices.forEach((s, i) => {
      const on = index === i;
      const dim = index !== null && !on;
      let dx = 0;
      let dy = 0;
      if (on) {
        const m = ((-90 + (s.before + s.share / 2) * 3.6) * Math.PI) / 180;
        dx = Math.cos(m) * LIFT;
        dy = Math.sin(m) * LIFT;
      }
      s.g.style.transform = `translate(${f3(dx)}px, ${f3(dy)}px)`;
      s.g.toggleAttribute("data-dim", dim);
      s.glow.setAttribute("stroke-width", on ? "5" : "3.5");
      s.glow.setAttribute("stroke-opacity", on ? "0.75" : "0.5");
    });
    this.buttons.forEach((b, i) => b.setAttribute("aria-pressed", index === i ? "true" : "false"));
    this.legend?.toggleAttribute("data-quiet", index !== null);

    if (!this.readout) return;
    const b = index === null ? null : this.buttons[index] || null;
    const value = b ? b.dataset.amount : this.total;
    const label = b ? b.dataset.name : this.caption;
    const share = b ? b.dataset.share : "";
    const next = this.readout.cloneNode(false);
    next.innerHTML =
      `<span class="donut__value">${value}</span><span class="donut__label">${label}</span>` +
      (share ? `<span class="donut__share">${share}</span>` : "");
    if (!reduced.matches) next.setAttribute("data-fade", "");
    this.readout.replaceWith(next);
    this.readout = next;
  }
}

document.querySelectorAll("[data-donut]").forEach((el) => new Donut(el));

/* ════════════════════════════════════════════════════════════════════════
   decade.js — R. Readings.

   R.1  Three readings that start when the page opens: published annual or
        monthly rates (footnoted in the markup) multiplied by elapsed time.
        Written straight to the DOM in tabular mono, so nothing shifts.

   No dependencies. Everything pauses off screen.
   ════════════════════════════════════════════════════════════════════════ */

const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const nInt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const nOne = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function onScreen(el, cb, margin = "120px") {
  const io = new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: margin });
  io.observe(el);
}


/* ── R.1 — since this page opened ─────────────────────────────────────── */

function live(root) {
  const cells = [...root.querySelectorAll("[data-dc-rate]")].map((el) => ({
    el: el.querySelector(".dc-n") || el,
    rate: parseFloat(el.dataset.dcRate),
    digits: parseInt(el.dataset.dcDigits || "0", 10),
    text: "",
  }));
  const clock = root.querySelector("[data-dc-clock]");
  let shown = false;
  let raf = 0;
  let last = 0;

  const write = (now) => {
    const s = performance.now() / 1000; // performance.now() counts from navigation: "since this page opened"
    for (const c of cells) {
      const v = c.rate * s;
      const t = c.digits ? nOne.format(Math.floor(v * 10) / 10) : nInt.format(Math.floor(v));
      if (t !== c.text) { c.el.firstChild.nodeValue = t; c.text = t; }
    }
    if (clock) {
      const sec = Math.floor(s);
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), r = sec % 60;
      const t = (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(r).padStart(2, "0");
      if (clock.textContent !== t) clock.textContent = t;
    }
    last = now;
  };
  const loop = (now) => {
    // Reduced motion: a calm four readings a second instead of every frame.
    if (!motion.matches || now - last > 250) write(now);
    raf = shown && !document.hidden ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf && shown && !document.hidden) raf = requestAnimationFrame(loop); };
  for (const c of cells) if (!c.el.firstChild) c.el.append("");
  write(0);
  onScreen(root, (v) => { shown = v; kick(); });
  document.addEventListener("visibilitychange", kick);
}

document.querySelectorAll("[data-decade-live]").forEach(live);

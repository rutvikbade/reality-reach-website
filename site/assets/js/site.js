/**
 * realityreach.com — the page's behaviour, everything except the ASCII
 * drawings (ascii.js) and the decade readings (decade.js).
 *
 * - The header steps out of the way while reading down and returns on the
 *   way up. It leaves entirely while a [data-solo] section (the CapWatch
 *   feature) sits under it: no corporate mark beside the CapWatch mark.
 * - Content settles in as it enters ([data-reveal] → data-in), once.
 * - The navigation marks the section being read (aria-current).
 *
 * Nothing here runs per frame except one rAF-throttled scroll handler.
 */

const root = document.documentElement;
const header = document.querySelector("[data-header]");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ── Header: hide on the way down, show on the way up ──────────────────── */
if (header) {
  let lastY = window.scrollY;
  let ticking = false;
  const SHOW_ABOVE = 96;   // always visible near the top of the page
  const DELTA = 6;         // ignore jitter

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) < DELTA) return;
    if (y < SHOW_ABOVE || dy < 0) header.removeAttribute("data-hidden");
    else if (!header.contains(document.activeElement)) header.setAttribute("data-hidden", "");
    lastY = y;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );

  header.addEventListener("focusin", () => header.removeAttribute("data-hidden"));

  // A solo section is "under the header" while it crosses the header strip.
  const solos = document.querySelectorAll("[data-solo]");
  if (solos.length && "IntersectionObserver" in window) {
    const under = new Set();
    const strip = () => {
      const h = header.getBoundingClientRect().height || 64;
      return `0px 0px -${Math.max(0, window.innerHeight - h)}px 0px`;
    };
    let observer;
    const observe = () => {
      observer?.disconnect();
      under.clear();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) under.add(entry.target);
            else under.delete(entry.target);
          }
          if (under.size) header.setAttribute("data-solo", "");
          else header.removeAttribute("data-solo");
        },
        { rootMargin: strip() }
      );
      solos.forEach((el) => observer.observe(el));
    };
    observe();
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(observe, 150);
    });
  }
}

/* ── Reveal on entry ───────────────────────────────────────────────────── */
const reveals = document.querySelectorAll("[data-reveal]");
if (reveals.length) {
  if (!("IntersectionObserver" in window) || reduced.matches) {
    reveals.forEach((el) => el.setAttribute("data-in", ""));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0 }
    );
    reveals.forEach((el) => io.observe(el));
  }
}

/* ── Current section in the navigation ─────────────────────────────────── */
const navLinks = new Map();
document.querySelectorAll("[data-nav]").forEach((a) => navLinks.set(a.dataset.nav, a));
if (navLinks.size && "IntersectionObserver" in window) {
  const sections = document.querySelectorAll("[data-section]");
  const visible = new Map();
  const mark = () => {
    let current = null;
    for (const [el, on] of visible) if (on) current = el.dataset.section;
    for (const [key, a] of navLinks) {
      if (key === current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      mark();
    },
    { rootMargin: "-45% 0px -54% 0px" }
  );
  sections.forEach((el) => {
    visible.set(el, false);
    io.observe(el);
  });
}

/* ── The year ──────────────────────────────────────────────────────────── */
const year = String(new Date().getFullYear());
document.querySelectorAll("[data-year]").forEach((el) => {
  if (Number(year) >= 2026) el.textContent = year;
});

root.setAttribute("data-ready", "");

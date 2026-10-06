/**
 * Plates and the theatre.
 *
 * A Plate is one canvas showing one figure, moving only while it is on
 * screen. The Theatre is the scroll story: a tall section with a sticky
 * stage. Each chapter holds its figure for the first HOLD of its scroll; then
 * the figure's matter travels into the next one. The camera turns with the
 * scroll the whole way, always the same way, so every figure is alive and a
 * change is part of one movement. The last chapter's tower rises with the scroll.
 *
 * One requestAnimationFrame loop serves every plate on the page. Clouds are
 * built once (the first figure at once, the rest when the browser is idle)
 * and shared.
 */

import { AsciiRenderer } from "./engine.js";
import { Camera, fit, keyLight, makePairing, rasterHold, rasterMorph } from "./raster.js";
import { HOLD, PARTS, identity, sceneByName } from "./scenes.js";
import { drain } from "./model.js";

export { HOLD };
const IDLE_FPS = 30;
/** Scroll (in chapters) over which the last figure finishes rising. */
const RISE_RUN = 0.85;

const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const fineQuery = window.matchMedia("(pointer: fine)");
const params = new URLSearchParams(window.location.search);
const forced = params.has("p") ? parseFloat(params.get("p")) : null;
const forcedT = params.has("t") ? parseFloat(params.get("t")) : null;

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/* ── Clouds ────────────────────────────────────────────────────────────── */

const clouds = new Map();
const pairings = new Map();

const jobs = new Map();
const SLICE_MS = 8;

/** A cloud now: finishes a build in progress, or builds it whole. */
function cloudFor(scene, n) {
  const key = scene.name + ":" + n;
  let c = clouds.get(key);
  if (!c) {
    const job = jobs.get(key);
    if (job) {
      c = drain(job.it);
      jobs.delete(key);
      clouds.set(key, c);
      for (const w of job.waiters) w(c);
    } else {
      c = scene.build(n);
      clouds.set(key, c);
    }
  }
  return c;
}

/* Slices run as separate tasks, so frames and input go between them. */
const tasks = [];
const channel = new MessageChannel();
channel.port1.onmessage = () => tasks.shift()?.();
function later(fn) {
  tasks.push(fn);
  channel.port2.postMessage(0);
}

/**
 * A cloud later: the same build, spread over slices of a few milliseconds
 * (the scene's `steps` generator), so no single task blocks the page.
 */
function cloudLater(scene, n, done) {
  const key = scene.name + ":" + n;
  const have = clouds.get(key);
  if (have) {
    done?.(have);
    return;
  }
  let job = jobs.get(key);
  if (job) {
    if (done) job.waiters.push(done);
    return;
  }
  if (!scene.steps) {
    idle(() => done?.(cloudFor(scene, n)));
    return;
  }
  job = { it: scene.steps(n), waiters: done ? [done] : [] };
  jobs.set(key, job);
  const pump = () => {
    if (jobs.get(key) !== job) return; // finished in the meantime by cloudFor
    const t0 = performance.now();
    let r;
    do r = job.it.next();
    while (!r.done && performance.now() - t0 < SLICE_MS);
    if (!r.done) {
      later(pump);
      return;
    }
    jobs.delete(key);
    clouds.set(key, r.value);
    for (const w of job.waiters) w(r.value);
  };
  later(pump);
}

function pairingFor(A, B, ca, cb, n) {
  const key = A.name + ">" + B.name + ":" + n;
  let p = pairings.get(key);
  if (!p) {
    p = makePairing(ca, cb, A.focus ? "radiate" : "pour", A.focus || [0, 0, 0]);
    pairings.set(key, p);
  }
  return p;
}

const idle = window.requestIdleCallback ? (fn) => window.requestIdleCallback(fn, { timeout: 1500 }) : (fn) => setTimeout(fn, 120);

/** Points per cloud for a canvas: enough to close a surface, no more. */
function pointsFor(r) {
  return Math.max(8000, Math.min(24000, Math.round(r.cols * r.rows * 1.9)));
}

/* ── Scheduler ─────────────────────────────────────────────────────────── */

const plates = [];
let raf = 0;
const perf = { frames: 0, total: 0, max: 0, last: 0, build: {} };
if (params.has("ascii-perf")) window.__asciiPerf = perf;

function loop(now) {
  raf = 0;
  let again = false;
  for (const p of plates) {
    if (!p.visible) continue;
    if (p.tick(now)) again = true;
  }
  if (again) raf = requestAnimationFrame(loop);
}

export function wake() {
  if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    for (const p of plates) p.dirty = true;
    wake();
  }
});
reducedQuery.addEventListener?.("change", () => {
  for (const p of plates) p.dirty = true;
  wake();
});

/* Pointer parallax: a few degrees, eased, on fine pointers only. */
const pointer = { x: 0, y: 0, ex: 0, ey: 0 };
window.addEventListener(
  "pointermove",
  (e) => {
    if (!fineQuery.matches || reducedQuery.matches || forced !== null) return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    wake();
  },
  { passive: true }
);

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const p = e.target.__plate;
      if (!p) continue;
      p.visible = e.isIntersecting;
      if (p.visible) {
        p.dirty = true;
        wake();
      }
    }
  },
  { rootMargin: "160px 0px" }
);

const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const p = e.target.__plate;
    if (p) p.dirty = true;
  }
  wake();
});

function record(start) {
  const ms = performance.now() - start;
  perf.frames++;
  perf.total += ms;
  perf.last = ms;
  if (ms > perf.max) perf.max = ms;
}

const LIGHT_SCRATCH = [0, 0, 0];

/** Sets a camera from a scene's rest pose, fitted to the renderer. */
function setCam(cam, scene, r) {
  const c = scene.cam;
  cam.yaw = c.yaw;
  cam.pitch = c.pitch;
  cam.dist = c.dist;
  cam.tx = 0;
  cam.ty = c.ty || 0;
  cam.tz = 0;
  cam.fogNear = scene.fog[0];
  cam.fogFar = scene.fog[1];
  cam.gap = 0.09;
  cam.edge = 0.07;
  const L = keyLight(c.yaw, LIGHT_SCRATCH);
  cam.lx = L[0];
  cam.ly = L[1];
  cam.lz = L[2];
  fit(cam, r, c.w, c.h, c.wn);
}

function blendCam(out, a, b, s) {
  out.yaw = a.yaw + (b.yaw - a.yaw) * s;
  out.pitch = a.pitch + (b.pitch - a.pitch) * s;
  out.dist = a.dist + (b.dist - a.dist) * s;
  out.ty = a.ty + (b.ty - a.ty) * s;
  out.f = a.f + (b.f - a.f) * s;
  out.fogNear = a.fogNear + (b.fogNear - a.fogNear) * s;
  out.fogFar = a.fogFar + (b.fogFar - a.fogFar) * s;
  out.gap = a.gap;
  out.edge = a.edge;
  const lx = a.lx + (b.lx - a.lx) * s, ly = a.ly + (b.ly - a.ly) * s, lz = a.lz + (b.lz - a.lz) * s;
  const l = Math.hypot(lx, ly, lz) || 1;
  out.lx = lx / l;
  out.ly = ly / l;
  out.lz = lz / l;
}

/** Links in a caption that is not on screen leave the keyboard order. */
function reachable(el, on) {
  for (const a of el.querySelectorAll("a[href], button")) {
    if (on) a.removeAttribute("tabindex");
    else a.setAttribute("tabindex", "-1");
  }
}

function resetParts(Mx) {
  for (let p = 0; p < PARTS; p++) identity(Mx, p);
}

/* ── Plate ─────────────────────────────────────────────────────────────── */

export class Plate {
  constructor(canvas, sceneName) {
    this.canvas = canvas;
    const font = parseFloat(canvas.dataset.asciiFont || "");
    this.renderer = new AsciiRenderer(canvas, { fontPx: font > 0 ? font : undefined });
    this.scene = sceneByName(sceneName);
    this.visible = false;
    this.dirty = true;
    this.lastDraw = 0;
    this.t0 = performance.now();
    this.cam = new Camera();
    this.camB = new Camera();
    this.camX = new Camera();
    this.MA = new Float32Array(PARTS * 12);
    this.MB = new Float32Array(PARTS * 12);
    this.n = 0;
    this.drawn = false;
    canvas.__plate = this;
    plates.push(this);
    io.observe(canvas);
    ro.observe(canvas);
    // A theme flip on an ancestor re-cuts the inks.
    this.mo = new MutationObserver(() => {
      this.renderer.refreshInk();
      this.dirty = true;
      wake();
    });
    let el = canvas;
    for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
      this.mo.observe(el, { attributes: true, attributeFilter: ["class", "data-theme"] });
    }
  }

  get still() {
    return reducedQuery.matches || forced !== null || forcedT !== null;
  }

  time(now) {
    if (forcedT !== null) return forcedT;
    if (this.still) return 0;
    return (now - this.t0) / 1000;
  }

  /** Renders if needed; returns true while it wants more frames. */
  tick(now) {
    const animated = !!this.scene && this.scene.animated && !this.still;
    const moving = this.parallaxMoving();
    const due = (animated || moving) && now - this.lastDraw >= 1000 / IDLE_FPS - 2;
    if (this.dirty || due) {
      this.dirty = false;
      this.lastDraw = now;
      this.render(now);
    }
    return animated || moving;
  }

  parallaxMoving() {
    const dx = pointer.x - pointer.ex, dy = pointer.y - pointer.ey;
    return Math.abs(dx) + Math.abs(dy) > 0.002;
  }

  /** Eases the shared pointer and turns the camera by it. */
  parallax(cam) {
    pointer.ex += (pointer.x - pointer.ex) * 0.08;
    pointer.ey += (pointer.y - pointer.ey) * 0.08;
    cam.yaw += pointer.ex * 0.06;
    cam.pitch += pointer.ey * 0.025;
  }

  ready() {
    const r = this.renderer;
    if (r.canvas.clientWidth === 0 || r.canvas.clientHeight === 0) return false;
    r.layout();
    if (!this.n) this.n = pointsFor(r);
    return true;
  }

  /**
   * The cloud for a scene. Until a plate has drawn once it waits for a sliced
   * build; after that a missing cloud is finished at once, so a frame never drops.
   */
  cloudOf(S) {
    const c = clouds.get(S.name + ":" + this.n);
    if (c) return c;
    if (this.drawn) return cloudFor(S, this.n);
    cloudLater(S, this.n, () => {
      this.dirty = true;
      wake();
    });
    return null;
  }

  render(now) {
    if (!this.scene || !this.ready()) return;
    const r = this.renderer;
    const start = performance.now();
    const c = this.cloudOf(this.scene);
    if (!c) return;
    this.drawn = true;
    const t = this.time(now);
    // A plate driven by its page (`data-p`, 0 … 1) holds that moment; others hold their end.
    const dp = this.canvas.dataset.p;
    const local = dp === undefined ? 1 : Math.min(1, Math.max(0, +dp || 0));
    setCam(this.cam, this.scene, r);
    resetParts(this.MA);
    this.scene.motion?.(t, local, this.MA, this.cam, c);
    this.parallax(this.cam);
    rasterHold(r, this.cam, c, this.MA, this.scene.rise ? this.scene.rise(local) : null, t);
    r.draw();
    record(start);
  }
}

/* ── Theatre ───────────────────────────────────────────────────────────── */

/** The sticky stage the canvas rides on: by class if named, else its sticky ancestor. */
function stageOf(section, canvas) {
  const named = section.querySelector(".theatre__stage, .stage, [data-stage]");
  if (named) return named;
  for (let el = canvas.parentElement; el && el !== section; el = el.parentElement) {
    if (getComputedStyle(el).position === "sticky") return el;
  }
  return null;
}

export class Theatre extends Plate {
  constructor(section, canvas) {
    super(canvas, "partnership");
    this.section = section;
    this.stage = stageOf(section, canvas);
    const names = (section.dataset.scenes || "partnership decade work").split(/\s+/).filter(Boolean);
    this.scenes = names.map(sceneByName).filter(Boolean);
    const declared = parseInt(getComputedStyle(section).getPropertyValue("--chapters"), 10);
    this.chapters = Math.min(declared > 0 ? declared : this.scenes.length, this.scenes.length);
    this.captions = Array.from(section.querySelectorAll("[data-chapter]"));
    this.ticks = Array.from(section.querySelectorAll("[data-tick]"));
    this.readFigure = section.querySelector('[data-readout="figure"]');
    this.readProgress = section.querySelector('[data-readout="progress"]');
    this.figures = this.scenes.map((s, i) => {
      const cap = this.captions.find((c) => Number(c.dataset.chapter) === i);
      return (cap && cap.dataset.figure) || s.figure;
    });
    this.P = -1;
    this.Praw = 0;
    this.active = -1;
    this.lastProgressText = "";
    const onScroll = () => {
      if (forced !== null) return;
      this.measure();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    this.measure();
    this.warm();
  }

  /** Builds the first figure now and the others when the browser is idle. */
  warm() {
    if (!this.ready()) {
      setTimeout(() => this.warm(), 200);
      return;
    }
    const first = Math.max(0, Math.min(this.scenes.length - 1, Math.floor(Math.max(0, this.P))));
    const order = [this.scenes[first], ...this.scenes.filter((_, i) => i !== first)];
    let others = false;
    const next = () => {
      // Then the page's other plates, so none builds as it scrolls into view.
      if (!order.length && !others) {
        others = true;
        for (const p of plates) if (p !== this && p.scene && p.ready()) order.push(p);
      }
      const item = order.shift();
      if (!item) return;
      const plate = item instanceof Plate ? item : this;
      const s = item instanceof Plate ? item.scene : item;
      const t1 = performance.now();
      cloudLater(s, plate.n, () => {
        perf.build[s.name] = performance.now() - t1;
        plate.dirty = true;
        wake();
        next();
      });
    };
    next();
  }

  /** Progress from the section's geometry: P ∈ [0, chapters − 1]. */
  measure() {
    const N = this.chapters;
    let raw;
    if (forced !== null) {
      raw = Math.max(0, forced);
    } else {
      const rect = this.section.getBoundingClientRect();
      const stageH = (this.stage && this.stage.offsetHeight) || window.innerHeight;
      const run = Math.max(1, rect.height - stageH);
      const r = Math.min(1, Math.max(0, -rect.top / run));
      raw = r * N;
    }
    const P = Math.min(N - 1, raw);
    this.Praw = Math.min(N, raw);
    if (P !== this.P || this.Praw !== this.lastRaw) {
      this.lastRaw = this.Praw;
      this.P = P;
      this.dirty = true;
      this.publish();
      if (this.visible) wake();
    }
  }

  /** Writes progress to the DOM: `--p`, the active chapter, the readouts. */
  publish() {
    const N = this.chapters;
    const P = this.P;
    const i = Math.min(N - 1, Math.floor(P));
    const m = i < N - 1 ? smoothstep(HOLD, 1, P - i) : 0;
    const active = Math.min(N - 1, i + (m >= 0.5 ? 1 : 0));
    this.section.style.setProperty("--p", (N > 1 ? P / (N - 1) : 0).toFixed(4));
    this.section.style.setProperty("--chapter-mix", m.toFixed(4));
    if (active !== this.active) {
      this.active = active;
      this.section.dataset.chapterActive = String(active);
      for (const c of this.captions) {
        const on = Number(c.dataset.chapter) === active;
        if (on) c.setAttribute("data-active", "");
        else c.removeAttribute("data-active");
        reachable(c, on);
      }
      for (const t of this.ticks) {
        if (Number(t.dataset.tick) === active) t.setAttribute("data-active", "");
        else t.removeAttribute("data-active");
      }
      if (this.readFigure && this.figures[active]) this.readFigure.textContent = this.figures[active];
    }
    if (this.readProgress) {
      const text = ((N > 1 ? P / (N - 1) : 0) * 100).toFixed(2).padStart(5, "0");
      if (text !== this.lastProgressText) {
        this.lastProgressText = text;
        this.readProgress.textContent = text;
      }
    }
  }

  tick(now) {
    const animated = !this.still;
    const moving = this.parallaxMoving();
    const due = (animated || moving) && now - this.lastDraw >= 1000 / IDLE_FPS - 2;
    if (this.dirty || due) {
      this.dirty = false;
      this.lastDraw = now;
      this.render(now);
    }
    return animated || moving;
  }

  /** A figure's rise at its own progress v (0 before its chapter, 1 once risen). */
  riseAt(S, v) {
    if (!S.rise) return null;
    if (reducedQuery.matches) return S.rise(v >= 0 ? 1 : 0);
    return S.rise(Math.min(1, Math.max(0, v / RISE_RUN)));
  }

  render(now) {
    if (!this.ready()) return;
    const r = this.renderer;
    const start = performance.now();
    const N = this.chapters;
    const P = Math.max(0, this.P);
    const i = Math.min(N - 1, Math.floor(P));
    const f = P - i;
    let m = i < N - 1 ? smoothstep(HOLD, 1, f) : 0;
    if (reducedQuery.matches) m = m >= 0.5 ? 1 : 0;
    const t = this.time(now);
    const A = this.scenes[i];
    const B = this.scenes[Math.min(N - 1, i + 1)];
    // Each figure reads its own progress v: P less its chapter, running on past
    // the last chapter so the tower rises as it is read.
    const Pv = Math.max(0, this.Praw);
    if (m <= 0 || m >= 1 || A === B) {
      const S = m >= 1 ? B : A;
      const idx = m >= 1 ? i + 1 : i;
      const c = this.cloudOf(S);
      if (!c) return;
      const v = Pv - idx;
      const rise = this.riseAt(S, v);
      setCam(this.cam, S, r);
      resetParts(this.MA);
      S.motion?.(t, v, this.MA, this.cam, c, rise);
      this.parallax(this.cam);
      rasterHold(r, this.cam, c, this.MA, rise, t);
    } else {
      const ca = this.cloudOf(A);
      const cb = ca && this.cloudOf(B);
      if (!ca || !cb) return;
      const pair = pairingFor(A, B, ca, cb, this.n);
      const vA = Pv - i, vB = Pv - (i + 1);
      const riseA = this.riseAt(A, vA), riseB = this.riseAt(B, vB);
      setCam(this.cam, A, r);
      setCam(this.camB, B, r);
      resetParts(this.MA);
      resetParts(this.MB);
      A.motion?.(t, vA, this.MA, this.cam, ca, riseA);
      B.motion?.(t, vB, this.MB, this.camB, cb, riseB);
      const s = m * m * (3 - 2 * m);
      blendCam(this.camX, this.cam, this.camB, s);
      this.parallax(this.camX);
      rasterMorph(r, this.camX, ca, this.MA, riseA, cb, this.MB, riseB, pair, m, t);
    }
    this.drawn = true;
    const mid = performance.now();
    r.draw();
    perf.draw = (perf.draw || 0) + (performance.now() - mid);
    perf.raster = (perf.raster || 0) + (mid - start);
    record(start);
  }
}

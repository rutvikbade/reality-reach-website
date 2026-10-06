/**
 * The rasteriser: a point cloud through a camera into character cells.
 *
 * Each frame every point is placed (its part's motion, a rise, or its flight
 * between two figures), projected through a perspective camera and kept if it
 * is the nearest in its cell. The winners are then shaded — a key light with
 * a wrap, ambient occlusion, a contour darkening, a specular glint on polished
 * things — and the darkness is printed through the tone table at the cell's
 * depth. Where a form meets paper, or passes in front of another, the cell
 * takes a stroke in the direction of the contour; a drawn line takes a stroke
 * in its own direction; matter in flight is a fine light dust.
 */

import { DQ, G_DOT, G_FALL, G_H, G_LOW, G_RISE, G_V } from "./engine.js";
import { LINE } from "./model.js";

/* ── Materials ─────────────────────────────────────────────────────────── */

export const M = {
  GROUND: 0, SHIRT: 1, SKIN: 2, HAIR: 3, SUIT_A: 4, SUIT_B: 5, TIE_A: 6, TIE_B: 7, SHOE: 8,
  DETAIL: 9, DETAIL_SOFT: 10, FAR: 11, LAND: 12, OCEAN: 13, GRAT: 14, ROUTE: 15, RING: 16,
  STEEL: 17, STEEL_SOFT: 18, GLASS: 19, WEIGHT: 20, WOOD: 21, CHAIR: 22, PAPER: 23, INDIA: 24,
};
const MAT_N = 25;
/** Darkness in full light, extra darkness in full shade, glint. */
const BASE = new Float32Array(MAT_N);
const RANGE = new Float32Array(MAT_N);
const SPEC = new Float32Array(MAT_N);
function mat(id, base, range = 0, spec = 0) {
  BASE[id] = base;
  RANGE[id] = range;
  SPEC[id] = spec;
}
mat(M.GROUND, 0, 0.5);
mat(M.SHIRT, 0.04, 0.22);
mat(M.SKIN, 0.12, 0.4, 0.12);
mat(M.HAIR, 0.66, 0.3, 0.35);
mat(M.SUIT_A, 0.5, 0.42, 0.05);
mat(M.SUIT_B, 0.64, 0.32, 0.06);
mat(M.TIE_A, 0.95, 0.05, 0.2);
mat(M.TIE_B, 0.9, 0.08, 0.35);
mat(M.SHOE, 0.76, 0.22, 0.95);
mat(M.DETAIL, 0.94);
mat(M.DETAIL_SOFT, 0.7);
mat(M.FAR, 0.46);
mat(M.LAND, 0.26, 0.5, 0.02);
mat(M.INDIA, 0.5, 0.42, 0.02);
mat(M.OCEAN, 0.0, 0.17);
mat(M.GRAT, 0.26);
mat(M.ROUTE, 0.5);
mat(M.RING, 0.28);
mat(M.STEEL, 0.9);
mat(M.STEEL_SOFT, 0.56);
mat(M.GLASS, 0.1, 0.34, 0.6);
mat(M.WEIGHT, 0.6, 0.36);
mat(M.WOOD, 0.4, 0.44, 0.35);
mat(M.CHAIR, 0.26, 0.42, 0.3);
mat(M.PAPER, 0.04, 0.32);

/* ── Camera ────────────────────────────────────────────────────────────── */

/**
 * A camera orbiting its target: `yaw` turns it around the vertical (0 looks
 * down −z from +z), `pitch` raises it (looking down), `dist` is its distance,
 * `f` its focal length in CSS px.
 */
export class Camera {
  constructor() {
    this.yaw = 0;
    this.pitch = 0;
    this.dist = 5;
    this.tx = 0;
    this.ty = 0;
    this.tz = 0;
    this.f = 400;
    this.fogNear = -1;
    this.fogFar = 1;
    this.lx = -0.5;
    this.ly = 0.66;
    this.lz = 0.56;
  }
  prepare() {
    this.cy = Math.cos(this.yaw);
    this.sy = Math.sin(this.yaw);
    this.cp = Math.cos(this.pitch);
    this.sp = Math.sin(this.pitch);
    // Direction toward the camera, world space.
    this.vx = this.sy * this.cp;
    this.vy = this.sp;
    this.vz = this.cy * this.cp;
  }
}

/**
 * Fits a scene's frame (w × h world units at the target) into the canvas. A
 * tall canvas (a phone) takes the narrower width `wn` if given, cropping the
 * figure's sides so the figure itself is larger.
 */
export function fit(cam, r, w, h, wn = w, margin = 0.9) {
  const W = r.cols * r.cw;
  const H = r.rows * r.ch;
  const ww = H > W * 1.12 ? wn : w;
  cam.aspect = W / H;
  cam.f = Math.min((W * margin) / ww, (H * margin) / h) * cam.dist;
}

/* ── Per-frame scratch ─────────────────────────────────────────────────── */

const scratch = { n: 0, s: null };
function ensure(n) {
  if (scratch.n !== n) {
    scratch.n = n;
    scratch.s = new Float32Array(n);
  }
}

/**
 * The key light, set relative to a camera's resting yaw: near the viewer,
 * above and a little to the left, so fronts are lit, every form turns into
 * shade on its right, and a cast shadow falls right and back.
 */
export function keyLight(yaw, out = [0, 0, 0]) {
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const vx = Math.sin(yaw), vz = Math.cos(yaw);
  const x = -0.38 * rx + 0.74 * vx, y = 0.58, z = -0.38 * rz + 0.74 * vz;
  const l = Math.hypot(x, y, z);
  out[0] = x / l;
  out[1] = y / l;
  out[2] = z / l;
  return out;
}

/* ── Placement ─────────────────────────────────────────────────────────── */

/** Writes point i of cloud c, moved by its part (matrices M) and rise, into out[o..o+2]. */
function place(c, i, Mx, rise, out, o) {
  const j = i * 3;
  let x = c.pos[j], y = c.pos[j + 1], z = c.pos[j + 2];
  let shown = true;
  // A rising figure: a point stands once the rise has reached its own height
  // (its key, 0 … 1 of the full height), so the build completes upwards in
  // place. A point above the rise is not drawn; it waits at the current top.
  if (c.riseKey && rise !== null) {
    const k = c.riseKey[i];
    if (k >= 0 && rise < k) {
      shown = false;
      const top = c.riseY0 + (c.riseY1 - c.riseY0) * rise;
      if (y > top) y = top;
    }
  }
  const p = c.part[i];
  if (p !== 0 && Mx) {
    const b = p * 12;
    const w = c.w[i];
    const nx = Mx[b] * x + Mx[b + 1] * y + Mx[b + 2] * z + Mx[b + 3];
    const ny = Mx[b + 4] * x + Mx[b + 5] * y + Mx[b + 6] * z + Mx[b + 7];
    const nz = Mx[b + 8] * x + Mx[b + 9] * y + Mx[b + 10] * z + Mx[b + 11];
    x += (nx - x) * w;
    y += (ny - y) * w;
    z += (nz - z) * w;
  }
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = z;
  return shown;
}

/** Normal (or direction) of point i, turned by its part. */
function normalOf(c, i, Mx, out, o) {
  const j = i * 3;
  let x = c.nrm[j], y = c.nrm[j + 1], z = c.nrm[j + 2];
  const p = c.part[i];
  if (p !== 0 && Mx && c.w[i] > 0.5) {
    const b = p * 12;
    const nx = Mx[b] * x + Mx[b + 1] * y + Mx[b + 2] * z;
    const ny = Mx[b + 4] * x + Mx[b + 5] * y + Mx[b + 6] * z;
    const nz = Mx[b + 8] * x + Mx[b + 9] * y + Mx[b + 10] * z;
    x = nx; y = ny; z = nz;
  }
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = z;
}

const P3 = new Float64Array(12); // 0–2 point · 8 sub-row · 9 cell · 10 depth · 11 sub-column

/* ── Projection ────────────────────────────────────────────────────────── */

function beginFrame(r) {
  r.zbuf.fill(1e9);
  r.win.fill(-1);
  r.glyph.fill(0);
}

/** Projects world (x,y,z); writes cell index into P3[9] (or −1), depth into P3[10]. */
function project(r, cam, x, y, z) {
  x -= cam.tx; y -= cam.ty; z -= cam.tz;
  const x1 = x * cam.cy - z * cam.sy;
  const z1 = x * cam.sy + z * cam.cy;
  const y2 = y * cam.cp - z1 * cam.sp;
  const z2 = y * cam.sp + z1 * cam.cp;
  const zc = cam.dist - z2;
  if (zc < 0.05) { P3[9] = -1; return; }
  const sx = r.W * 0.5 + (cam.f * x1) / zc;
  const sy = r.H * 0.5 - (cam.f * y2) / zc;
  const fx = (sx - r.ox) / r.cw;
  const fy = (sy - r.oy) / r.ch;
  const c = Math.floor(fx);
  const rr = Math.floor(fy);
  if (c < 0 || rr < 0 || c >= r.cols || rr >= r.rows) { P3[9] = -1; return; }
  P3[9] = rr * r.cols + c;
  P3[10] = zc;
  P3[11] = fx - c;
  P3[8] = fy - rr;
}

/**
 * Writes a point into its cell, and — for surfaces, a little deeper so it
 * never hides a real neighbour — into the adjacent cell on the side it sits
 * nearest, so a surface closes without needing more points. Lines stay one
 * cell wide.
 */
function splat(r, k, wide) {
  const cell = P3[9];
  const zc = P3[10];
  const zb = r.zbuf, win = r.win;
  if (zc < zb[cell]) { zb[cell] = zc; win[cell] = k; }
  if (!wide) return;
  const cols = r.cols;
  const c = cell % cols;
  const zn = zc + SPLAT_BIAS;
  const nx = P3[11] < 0.5 ? (c > 0 ? cell - 1 : -1) : c < cols - 1 ? cell + 1 : -1;
  if (nx >= 0 && zn < zb[nx]) { zb[nx] = zn; win[nx] = k; }
  const dy = P3[8];
  if (dy < 0.25 && cell >= cols) {
    const j = cell - cols;
    if (zn < zb[j]) { zb[j] = zn; win[j] = k; }
  } else if (dy > 0.75 && cell + cols < zb.length) {
    const j = cell + cols;
    if (zn < zb[j]) { zb[j] = zn; win[j] = k; }
  }
}
const SPLAT_BIAS = 0.015;

/** Screen direction of a world vector at the camera → a stroke glyph (or the dot). */
function strokeFor(cam, dx, dy, dz) {
  const x1 = dx * cam.cy - dz * cam.sy;
  const z1 = dx * cam.sy + dz * cam.cy;
  const y2 = dy * cam.cp - z1 * cam.sp;
  const sx = x1;
  const sy = -y2;
  const len = Math.hypot(sx, sy);
  const full = Math.hypot(dx, dy, dz) || 1;
  if (len < 0.28 * full) return G_DOT;
  let a = Math.atan2(sy, sx);
  if (a < 0) a += Math.PI;
  const d = (a * 180) / Math.PI;
  if (d < 24 || d > 156) return G_H;
  if (d > 68 && d < 112) return G_V;
  return d <= 68 ? G_FALL : G_RISE;
}

/* ── Hold ──────────────────────────────────────────────────────────────── */

/** One figure at rest (with its own motion). */
export function rasterHold(r, cam, c, Mx, rise, pulseT) {
  beginFrame(r);
  cam.prepare();
  const n = c.n;
  for (let i = 0; i < n; i++) {
    if (!place(c, i, Mx, rise, P3, 0)) continue;
    project(r, cam, P3[0], P3[1], P3[2]);
    if (P3[9] >= 0) splat(r, i, c.kind[i] !== LINE);
  }
  fill(r, cam);
  CUR.c = c;
  CUR.MA = Mx;
  shade(r, cam, infoHold, pulseT);
}

/** What shading needs to know about a winner — set per frame, read by the info functions (no per-frame closures). */
const CUR = { c: null, A: null, B: null, MA: null, MB: null };

function infoHold(i, out) {
  const c = CUR.c;
  normalOf(c, i, CUR.MA, out, 0);
  out[3] = c.mat[i];
  out[4] = c.ao[i];
  out[5] = c.kind[i];
  out[6] = c.phase[i];
  out[7] = 0; // not in flight
}

function infoMorph(k, out) {
  const s = scratch.s[k];
  const A = CUR.A, B = CUR.B;
  const src = s < 0.5 ? A : B;
  normalOf(src, k, s < 0.5 ? CUR.MA : CUR.MB, out, 0);
  out[3] = src.mat[k];
  out[4] = src.ao[k];
  out[5] = src.kind[k];
  out[6] = src.phase[k];
  out[7] = s > 0.035 && s < 0.965 ? 1 : 0;
}

/* ── Change-over ───────────────────────────────────────────────────────── */

/** How far apart departures are spread across a change (each point then flies for the rest). */
const FLIGHT_SPREAD = 0.62;
/** The distance from the focus that departs last in a radiating change (stage units). */
const RADIATE_REACH = 1.15;

/**
 * A pairing between two clouds: per rank, a delay (who leaves first) and a
 * bend (how the path arcs), so the change reads as matter reorganising.
 */
export function makePairing(A, B, style, focus) {
  const n = A.n;
  const delay = new Float32Array(n);
  const bend = new Float32Array(n * 3);
  const PA = A.pos, PB = B.pos;
  let maxD = 1e-6, minY = 1e9, maxY = -1e9;
  for (let k = 0; k < n; k++) {
    const ia = k * 3, ib = k * 3;
    if (style === "radiate") {
      // Measured against the figure's own reach (RADIATE_REACH), not the
      // farthest point in the cloud: a far horizon must not compress the
      // figure's departures into the first instant of the change.
      const d = Math.hypot(PA[ia] - focus[0], PA[ia + 1] - focus[1], PA[ia + 2] - focus[2]);
      delay[k] = Math.min(d, RADIATE_REACH);
      maxD = RADIATE_REACH;
    } else {
      const y = PB[ib + 1];
      delay[k] = y;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const rnd = (k) => {
    const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let k = 0; k < n; k++) {
    const ia = k * 3, ib = k * 3;
    const u = style === "radiate" ? delay[k] / maxD : (delay[k] - minY) / Math.max(1e-6, maxY - minY);
    delay[k] = Math.min(FLIGHT_SPREAD, u * (FLIGHT_SPREAD - 0.07) + rnd(k) * 0.07);
    // Bend: outward from the vertical axis through the midpoint, and a lift.
    const mx = (PA[ia] + PB[ib]) * 0.5, mz = (PA[ia + 2] + PB[ib + 2]) * 0.5;
    const l = Math.hypot(mx, mz) || 1;
    const amp = style === "radiate" ? 0.3 : 0.24;
    const swirl = rnd(k + 7) - 0.5;
    bend[k * 3] = (mx / l) * amp + (-mz / l) * swirl * 0.5;
    bend[k * 3 + 1] = style === "radiate" ? 0.12 + rnd(k + 3) * 0.18 : -0.04 + rnd(k + 3) * 0.12;
    bend[k * 3 + 2] = (mz / l) * amp + (mx / l) * swirl * 0.5;
  }
  return { delay, bend, scaleA: 1, scaleB: 1 };
}

const QA = new Float64Array(3);
const QB = new Float64Array(3);

/**
 * Between two figures: rank k travels from A's point to B's along a bent
 * path, leaving at its own delay. `m` is the change's progress (0 … 1).
 */
export function rasterMorph(r, cam, A, MA, riseA, B, MB, riseB, pair, m, pulseT) {
  beginFrame(r);
  cam.prepare();
  const n = A.n;
  ensure(n);
  const S = scratch.s;
  const { delay, bend } = pair;
  // Both clouds are stored in rank order: rank k is point k of each. A point
  // not yet departed, or already arrived, needs only one figure's position.
  const inv = 1 / (1 - FLIGHT_SPREAD);
  for (let k = 0; k < n; k++) {
    let e = (m - delay[k]) * inv;
    e = e < 0 ? 0 : e > 1 ? 1 : e;
    const s = e * e * e * (e * (e * 6 - 15) + 10);
    S[k] = s;
    let x, y, z;
    if (s <= 0) {
      if (!place(A, k, MA, riseA, QA, 0)) continue;
      x = QA[0]; y = QA[1]; z = QA[2];
    } else if (s >= 1) {
      // A point bound for a part not yet built joins the top and waits there, unseen.
      if (!place(B, k, MB, riseB, QB, 0)) continue;
      x = QB[0]; y = QB[1]; z = QB[2];
    } else {
      place(A, k, MA, riseA, QA, 0);
      place(B, k, MB, riseB, QB, 0);
      const lift = Math.sin(Math.PI * s);
      x = QA[0] + (QB[0] - QA[0]) * s + bend[k * 3] * lift;
      y = QA[1] + (QB[1] - QA[1]) * s + bend[k * 3 + 1] * lift;
      z = QA[2] + (QB[2] - QA[2]) * s + bend[k * 3 + 2] * lift;
    }
    project(r, cam, x, y, z);
    if (P3[9] >= 0) splat(r, k, (s < 0.5 ? A.kind[k] : B.kind[k]) !== LINE);
  }
  fill(r, cam);
  CUR.A = A;
  CUR.B = B;
  CUR.MA = MA;
  CUR.MB = MB;
  shade(r, cam, infoMorph, pulseT);
}

/* ── Gaps ──────────────────────────────────────────────────────────────── */

/** Closes single-cell gaps inside a surface (never across a depth step). */
function fill(r, cam) {
  const { cols, rows, zbuf: zb, win } = r;
  const th = cam.gap;
  for (let rr = 1; rr < rows - 1; rr++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = rr * cols + c;
      if (win[i] >= 0) continue;
      const l = i - 1, rt = i + 1, u = i - cols, d = i + cols;
      if (win[l] >= 0 && win[rt] >= 0 && Math.abs(zb[l] - zb[rt]) < th) {
        const near = zb[l] < zb[rt] ? l : rt;
        win[i] = win[near];
        zb[i] = (zb[l] + zb[rt]) * 0.5;
      } else if (win[u] >= 0 && win[d] >= 0 && Math.abs(zb[u] - zb[d]) < th) {
        const near = zb[u] < zb[d] ? u : d;
        win[i] = win[near];
        zb[i] = (zb[u] + zb[d]) * 0.5;
      }
    }
  }
}

/* ── Shading ───────────────────────────────────────────────────────────── */

/**
 * Whether the cell (dc, dr) away is occupied for a contour test: solid and
 * not far behind; or, if it is paper, the cell beyond it is solid (so a
 * stray gap inside a surface never draws a contour).
 */
function occ(r, c, rr, z, far, dc, dr) {
  const { cols, rows, flag, zbuf: zb } = r;
  let c2 = c + dc, r2 = rr + dr;
  if (c2 < 0 || r2 < 0 || c2 >= cols || r2 >= rows) return 0;
  let j = r2 * cols + c2;
  let f2 = flag[j];
  if (f2 === FLAG_TONE || f2 === FLAG_STROKE) return zb[j] < z + far ? 1 : 0;
  c2 += dc;
  r2 += dr;
  if (c2 < 0 || r2 < 0 || c2 >= cols || r2 >= rows) return 0;
  j = r2 * cols + c2;
  f2 = flag[j];
  return (f2 === FLAG_TONE || f2 === FLAG_STROKE) && zb[j] < z + far ? 1 : 0;
}

/** 1 if the cell (c, rr) shows sea. */
function sea(r, c, rr) {
  if (c < 0 || rr < 0 || c >= r.cols || rr >= r.rows) return 0;
  const j = rr * r.cols + c;
  return r.flag[j] === FLAG_TONE && r.cmat[j] === M.OCEAN ? 1 : 0;
}

const INFO = new Float32Array(9);

/** Depth fog level 0 (near) … 3 (far) for a camera distance. */
function fogOf(z, z0, zr) {
  let zf = (z - z0) * zr;
  zf = zf < 0 ? 0 : zf > 0.999 ? 0.999 : zf;
  return Math.min(3, Math.floor(zf * 4));
}
const FLAG_TONE = 1;
const FLAG_STROKE = 2;
const FLAG_GROUND = 3;

/**
 * Three passes. First every winning cell gets a darkness (tones) or a
 * stroke (lines, matter in flight). Then tones are smoothed with their
 * neighbours on the same surface, so light falls across a form instead of
 * flickering cell to cell. Last, a toned cell on a silhouette — against
 * paper, or in front of something well behind it — takes a contour stroke.
 */
function shade(r, cam, info, pulseT) {
  const { cols, rows, zbuf: zb, win, glyph, ink, lut, strokeInk, dark, flag, cmat } = r;
  const lx = cam.lx, ly = cam.ly, lz = cam.lz;
  const vx = cam.vx, vy = cam.vy, vz = cam.vz;
  let hx = lx + vx, hy = ly + vy, hz = lz + vz;
  const hl = Math.hypot(hx, hy, hz) || 1;
  hx /= hl; hy /= hl; hz /= hl;
  const z0 = cam.dist + cam.fogNear;
  const zr = 1 / Math.max(1e-6, cam.fogFar - cam.fogNear);
  const n = cols * rows;

  // 1 · darkness or stroke per cell.
  for (let cell = 0; cell < n; cell++) {
    flag[cell] = 0;
    const k = win[cell];
    if (k < 0) continue;
    info(k, INFO);
    const nx = INFO[0], ny = INFO[1], nz = INFO[2];
    const mt = INFO[3] | 0;
    const kind = INFO[5];
    cmat[cell] = mt;
    if (INFO[7] || kind === LINE) {
      let D;
      let dot = INFO[7] || mt === M.GRAT;
      if (INFO[7]) D = 0.3;
      else if (mt === M.ROUTE) {
        // A route is a dotted arc; a dash travels out along it.
        let u = INFO[6] * 2.2 - pulseT * 0.5;
        u -= Math.floor(u);
        const pulse = Math.pow(1 - u, 8);
        D = 0.2 + 0.72 * pulse;
        dot = pulse < 0.3;
      } else D = BASE[mt];
      const q = Math.round(Math.min(1, D) * (DQ - 1));
      glyph[cell] = dot ? G_DOT : strokeFor(cam, nx, ny, nz);
      ink[cell] = strokeInk[fogOf(zb[cell], z0, zr) * DQ + q];
      flag[cell] = FLAG_STROKE;
      continue;
    }
    const ao = INFO[4];
    const ndl = nx * lx + ny * ly + nz * lz;
    const wrap = Math.max(0, (ndl + 0.2) / 1.2);
    const ndv = nx * vx + ny * vy + nz * vz;
    const rim = 1 - Math.max(0, ndv);
    const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
    const spec = SPEC[mt] > 0 ? Math.pow(ndh, 28) * SPEC[mt] : 0;
    const lam = 0.2 * ao + 0.8 * wrap * Math.sqrt(ao);
    let D = BASE[mt] + RANGE[mt] * (1 - lam) + 0.14 * rim * rim * rim - 0.75 * spec;
    if (mt === M.GROUND) {
      dark[cell] = RANGE[mt] * (1 - ao);
      flag[cell] = FLAG_GROUND;
      continue;
    }
    dark[cell] = D < 0.075 ? 0.075 : D > 1 ? 1 : D;
    flag[cell] = FLAG_TONE;
  }

  // 2 · smoothing across a surface — same material, near in depth — one
  // pass into dark2, a second as the glyphs are written. Material edges
  // (a shirt against a lapel, a tie against a shirt) stay sharp.
  const th = cam.edge;
  const dark2 = r.dark2;
  for (let rr = 0; rr < rows; rr++) {
    for (let c = 0; c < cols; c++) {
      const cell = rr * cols + c;
      const fl = flag[cell];
      if (fl !== FLAG_TONE && fl !== FLAG_GROUND) continue;
      const z = zb[cell];
      const m0 = cmat[cell];
      let sum = dark[cell] * 2, wsum = 2;
      if (c > 0 && flag[cell - 1] === fl && cmat[cell - 1] === m0 && Math.abs(zb[cell - 1] - z) < th) { sum += dark[cell - 1]; wsum++; }
      if (c < cols - 1 && flag[cell + 1] === fl && cmat[cell + 1] === m0 && Math.abs(zb[cell + 1] - z) < th) { sum += dark[cell + 1]; wsum++; }
      if (rr > 0 && flag[cell - cols] === fl && cmat[cell - cols] === m0 && Math.abs(zb[cell - cols] - z) < th) { sum += dark[cell - cols] * 1.5; wsum += 1.5; }
      if (rr < rows - 1 && flag[cell + cols] === fl && cmat[cell + cols] === m0 && Math.abs(zb[cell + cols] - z) < th) { sum += dark[cell + cols] * 1.5; wsum += 1.5; }
      dark2[cell] = sum / wsum;
    }
  }
  for (let rr = 0; rr < rows; rr++) {
    for (let c = 0; c < cols; c++) {
      const cell = rr * cols + c;
      const fl = flag[cell];
      if (fl !== FLAG_TONE && fl !== FLAG_GROUND) continue;
      const z = zb[cell];
      const m0 = cmat[cell];
      let sum = dark2[cell] * 2, wsum = 2;
      if (c > 0 && flag[cell - 1] === fl && cmat[cell - 1] === m0 && Math.abs(zb[cell - 1] - z) < th) { sum += dark2[cell - 1]; wsum++; }
      if (c < cols - 1 && flag[cell + 1] === fl && cmat[cell + 1] === m0 && Math.abs(zb[cell + 1] - z) < th) { sum += dark2[cell + 1]; wsum++; }
      if (rr > 0 && flag[cell - cols] === fl && cmat[cell - cols] === m0 && Math.abs(zb[cell - cols] - z) < th) { sum += dark2[cell - cols] * 1.5; wsum += 1.5; }
      if (rr < rows - 1 && flag[cell + cols] === fl && cmat[cell + cols] === m0 && Math.abs(zb[cell + cols] - z) < th) { sum += dark2[cell + cols] * 1.5; wsum += 1.5; }
      let D = sum / wsum;
      let g = -1;
      if (fl === FLAG_TONE) {
        // 3 · contours: against paper, or in front of something far behind.
        // A neighbour counts as paper only if the cell beyond it is paper too,
        // so a stray gap inside a surface never draws a contour.
        const far = th * 3.5;
        const oL = occ(r, c, rr, z, far, -1, 0), oR = occ(r, c, rr, z, far, 1, 0);
        const oU = occ(r, c, rr, z, far, 0, -1), oD = occ(r, c, rr, z, far, 0, 1);
        if (oL + oR + oU + oD < 4) {
          const oUL = occ(r, c, rr, z, far, -1, -1), oUR = occ(r, c, rr, z, far, 1, -1);
          const oDL = occ(r, c, rr, z, far, -1, 1), oDR = occ(r, c, rr, z, far, 1, 1);
          const gx = oUR + 2 * oR + oDR - (oUL + 2 * oL + oDL);
          const gy = oDL + 2 * oD + oDR - (oUL + 2 * oU + oUR);
          if (gx !== 0 || gy !== 0) {
            // The contour runs across the gradient, measured in pixels.
            let d = (Math.atan2(gy / r.ch, gx / r.cw) * 180) / Math.PI + 90;
            d = ((d % 180) + 180) % 180;
            if (d < 24 || d > 156) g = gy < 0 ? G_LOW : G_H;
            else if (d > 66 && d < 114) g = G_V;
            else g = d <= 66 ? G_FALL : G_RISE;
            if (D < 0.62) D = 0.62;
          }
        }
      }
      if (g < 0 && fl === FLAG_TONE && (m0 === M.LAND || m0 === M.INDIA)) {
        // A coast: land beside sea is drawn as a line along the shore.
        const sL = sea(r, c - 1, rr), sR = sea(r, c + 1, rr), sU = sea(r, c, rr - 1), sD = sea(r, c, rr + 1);
        if (sL + sR + sU + sD > 0) {
          const sUL = sea(r, c - 1, rr - 1), sUR = sea(r, c + 1, rr - 1), sDL = sea(r, c - 1, rr + 1), sDR = sea(r, c + 1, rr + 1);
          const gx = sUR + 2 * sR + sDR - (sUL + 2 * sL + sDL);
          const gy = sDL + 2 * sD + sDR - (sUL + 2 * sU + sUR);
          if (gx !== 0 || gy !== 0) {
            let d = (Math.atan2(gy / r.ch, gx / r.cw) * 180) / Math.PI + 90;
            d = ((d % 180) + 180) % 180;
            if (d < 24 || d > 156) g = gy > 0 ? G_LOW : G_H;
            else if (d > 66 && d < 114) g = G_V;
            else g = d <= 66 ? G_FALL : G_RISE;
            if (D < 0.72) D = 0.72;
          }
        }
      }
      const q = Math.round(D * (DQ - 1));
      const fog = fogOf(z, z0, zr);
      if (g >= 0) {
        glyph[cell] = g;
        ink[cell] = strokeInk[fog * DQ + q];
      } else {
        const code = lut[fog * DQ + q];
        glyph[cell] = code >> 2;
        ink[cell] = code & 3;
      }
    }
  }
}

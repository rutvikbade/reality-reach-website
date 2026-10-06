/**
 * FIG. R.2 — The second half of the chessboard.
 *
 * The parable: one grain on the first square, doubling on every square after,
 * so each new square holds more than every square before it combined
 * (Kurzweil 1999; Brynjolfsson & McAfee 2014).
 *
 * Sixty-four stacks on an 8 × 8 board, laid in the parable's path — rank by
 * rank, turning at the end of each — so square 33 stands directly behind
 * square 32. Each stack is drawn at its true doubling height relative to
 * square 32: the first half stays a quiet staircase of grains, square 33
 * outgrows the plate, and the second half leaves the frame entirely.
 *
 * The plate's progress (0 … 1, set on the canvas by chess.js) drives it:
 *   0.00–0.40  first half — squares 1 … 32 are laid
 *   0.40–0.62  the turn — square 33 rises; the camera tilts up after it
 *   0.62–1.00  second half — squares 34 … 64; the camera pulls back
 *
 * The cloud is built once; each frame only re-heights the stacks.
 */

import { Cloud, SURF, LINE } from "./model.js";
import { M } from "./raster.js";

const D2R = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/* ── The board ─────────────────────────────────────────────────────────── */

const SQ = 0.25; // one square, in metres of the drawing
const HW = 0.062; // a stack's half-width: slender, so files stand apart
const H32 = 1.0; // square 32's stack; every other height follows by doubling
const GRAIN = 0.014; // the least a laid square shows: a grain
const SLAB = 0.07; // board thickness
const COURSES = 22; // course slots per stack (horizontal bands, a floor's rhythm)

/** Centre of square k (0 … 63) along the parable's path. */
function centre(k, out) {
  const r = k >> 3;
  let f = k & 7;
  if (r & 1) f = 7 - f;
  out[0] = -0.875 + f * SQ;
  out[1] = 0.875 - r * SQ;
  return out;
}

/** True height of square s (1 … 64): square 32 is H32, each one doubles the last. */
export function trueHeight(s) {
  return H32 * Math.pow(2, s - 32);
}

/* ── Point roles ───────────────────────────────────────────────────────── */

const T_STATIC = 0;
const T_FACE_X = 1; // the +x face: A = z offset, U = height share
const T_FACE_Z = 2; // the +z face: A = x offset, U = height share
const T_TOP = 3; // the top: A = x, B = z offsets
const T_EDGE = 4; // a vertical edge: A, B = corner offsets, U = height share
const T_RIM = 5; // the top's outline: A, B = offsets
const T_COURSE = 6; // a course on a face: A = offset along, B = slot, U = 0 (+z face) or 1 (+x face)

const EDGES = [
  [HW, HW],
  [HW, -HW],
  [-HW, HW],
];

/* ── Build ─────────────────────────────────────────────────────────────── */

function buildChess(nWanted) {
  // A board of sixty-four towers needs more matter than one figure.
  const n = Math.max(12000, Math.min(36000, Math.round(nWanted * 1.5)));
  const c = new Cloud(n);
  const K = new Int8Array(n).fill(-1);
  const T = new Uint8Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  const U = new Float32Array(n);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  let i = 0;

  const put = (x, y, z, nx, ny, nz, kind, mat, ao = 1) => {
    if (i >= n) return -1;
    const j = i * 3;
    c.pos[j] = x; c.pos[j + 1] = y; c.pos[j + 2] = z;
    c.nrm[j] = nx; c.nrm[j + 1] = ny; c.nrm[j + 2] = nz;
    c.kind[i] = kind;
    c.mat[i] = mat;
    c.ao[i] = ao;
    return i++;
  };

  /* Board: 24 % — dark squares, the grid, the slab's two near faces. */
  const nBoard = Math.round(n * 0.2);
  const nDark = Math.round(nBoard * 0.66);
  const nGrid = Math.round(nBoard * 0.12);
  const nSlab = nBoard - nDark - nGrid;
  for (let q = 0; q < nDark; q++) {
    // Dark squares: those with (rank + file) even, a classic board.
    let r, f;
    do {
      r = (rand() * 8) | 0;
      f = (rand() * 8) | 0;
    } while ((r + f) & 1);
    const x = -1 + (f + rand()) * SQ, z = -1 + (r + rand()) * SQ;
    put(x, 0.0005, z, 0, 1, 0, SURF, M.WOOD, 1);
  }
  for (let q = 0; q < nGrid; q++) {
    // The board's outline only: the squares themselves make the pattern.
    const side = q & 3;
    const along = -1 + rand() * 2;
    if (side === 0) put(along, 0.001, 1, 1, 0, 0, LINE, M.DETAIL);
    else if (side === 1) put(along, 0.001, -1, 1, 0, 0, LINE, M.DETAIL);
    else if (side === 2) put(1, 0.001, along, 0, 0, 1, LINE, M.DETAIL);
    else put(-1, 0.001, along, 0, 0, 1, LINE, M.DETAIL);
  }
  for (let q = 0; q < nSlab; q++) {
    const u = rand();
    const role = u < 0.36 ? 0 : u < 0.72 ? 1 : 2;
    if (role === 0) put(-1 + rand() * 2, -rand() * SLAB, 1.0, 0, 0, 1, SURF, M.CHAIR, 0.9);
    else if (role === 1) put(1.0, -rand() * SLAB, -1 + rand() * 2, 1, 0, 0, SURF, M.CHAIR, 0.9);
    else {
      // The slab's lower edges, drawn.
      const a = -1 + rand() * 2;
      if (rand() < 0.5) put(a, -SLAB, 1.0, 1, 0, 0, LINE, M.DETAIL);
      else put(1.0, -SLAB, a, 0, 0, 1, LINE, M.DETAIL);
    }
  }

  /* Stacks. */
  const share = new Float64Array(64);
  const nMarkers = 24 * 12;
  const nTurn = Math.round(n * 0.14);
  const nNext = Math.round(n * 0.07);
  const nStair = Math.round(n * 0.13);
  const nPillars = n - i - nMarkers - nTurn - nNext - nStair;
  let stairW = 0;
  for (let s = 25; s <= 32; s++) stairW += 0.06 + Math.sqrt(trueHeight(s));
  for (let s = 1; s <= 64; s++) {
    if (s <= 24) share[s - 1] = 12;
    else if (s <= 32) share[s - 1] = Math.round((nStair * (0.06 + Math.sqrt(trueHeight(s)))) / stairW);
    else if (s === 33) share[s - 1] = nTurn;
    else if (s === 34) share[s - 1] = nNext;
    else share[s - 1] = Math.floor(nPillars / 30);
  }

  const C = [0, 0];
  for (let k = 0; k < 64; k++) {
    const N = share[k];
    // Squares 35 … 64 are drawn, not filled: seen far off and far taller
    // than the frame, they stand as clean lines with a whisper of tone.
    const pillar = k >= 34;
    centre(k, C);
    if (N <= 12) {
      // A grain: a top and two faces, nothing more.
      for (let q = 0; q < N && i < n; q++) {
        const role = q % 3;
        const a = (rand() * 2 - 1) * HW, b = (rand() * 2 - 1) * HW;
        const t = role === 0 ? T_TOP : role === 1 ? T_FACE_X : T_FACE_Z;
        const id = put(0, 0, 0, t === T_FACE_X ? 1 : 0, t === T_TOP ? 1 : 0, t === T_FACE_Z ? 1 : 0, SURF, M.SUIT_A, 0.85);
        K[id] = k; T[id] = t; A[id] = a; B[id] = b; U[id] = rand();
      }
      continue;
    }
    // Faces carry the tone; edges and courses carry the drawing. The far
    // towers lean on line work: they are seen small and very tall.
    const fFace = pillar ? 0 : 0.6;
    const fTop = pillar ? 0.01 : 0.07;
    const fEdge = pillar ? 0.97 : 0.13;
    const fRim = pillar ? 0.01 : 0.06;
    const nF = Math.round(N * fFace), nT = Math.round(N * fTop), nE = Math.round(N * fEdge), nR = Math.round(N * fRim);
    const nC = pillar ? 0 : N - nF - nT - nE - nR;
    const faceMat = pillar ? M.GRAT : M.SUIT_A;
    for (let q = 0; q < nF; q++) {
      const t = pillar ? T_FACE_Z : q & 1 ? T_FACE_X : T_FACE_Z;
      const id = put(0, 0, 0, t === T_FACE_X ? 1 : 0, 0, t === T_FACE_Z ? 1 : 0, SURF, faceMat);
      if (id < 0) break;
      K[id] = k; T[id] = t; A[id] = (rand() * 2 - 1) * HW; U[id] = pillar ? (q + rand()) / nF : rand();
    }
    for (let q = 0; q < nT; q++) {
      const id = put(0, 0, 0, 0, 1, 0, SURF, M.SUIT_A);
      if (id < 0) break;
      K[id] = k; T[id] = T_TOP; A[id] = (rand() * 2 - 1) * HW; B[id] = (rand() * 2 - 1) * HW;
    }
    for (let q = 0; q < nE; q++) {
      // Stratified up each edge, so a long edge reads as one unbroken stroke.
      const e = EDGES[q % 3];
      const per = Math.ceil(nE / 3);
      const id = put(0, 0, 0, 0, 1, 0, LINE, M.DETAIL);
      if (id < 0) break;
      K[id] = k; T[id] = T_EDGE; A[id] = e[0] * 1.02; B[id] = e[1] * 1.02; U[id] = (Math.floor(q / 3) + rand()) / per;
    }
    for (let q = 0; q < nR; q++) {
      const side = q & 3;
      const a = (rand() * 2 - 1) * HW;
      let x, z, dx, dz;
      if (side === 0) { x = a; z = HW; dx = 1; dz = 0; }
      else if (side === 1) { x = HW; z = a; dx = 0; dz = 1; }
      else if (side === 2) { x = a; z = -HW; dx = 1; dz = 0; }
      else { x = -HW; z = a; dx = 0; dz = 1; }
      const id = put(0, 0, 0, dx, 0, dz, LINE, M.DETAIL);
      if (id < 0) break;
      K[id] = k; T[id] = T_RIM; A[id] = x * 1.02; B[id] = z * 1.02;
    }
    for (let q = 0; q < nC; q++) {
      const slot = q % COURSES;
      const onX = (q / COURSES) & 1;
      const id = put(0, 0, 0, onX ? 0 : 1, 0, onX ? 1 : 0, LINE, M.DETAIL_SOFT);
      if (id < 0) break;
      K[id] = k; T[id] = T_COURSE; A[id] = (rand() * 2 - 1) * HW; B[id] = slot; U[id] = onX;
    }
  }
  // Anything left over joins the board's dark squares.
  while (i < n) {
    let r, f;
    do {
      r = (rand() * 8) | 0;
      f = (rand() * 8) | 0;
    } while ((r + f) & 1);
    put(-1 + (f + rand()) * SQ, 0.0005, -1 + (r + rand()) * SQ, 0, 1, 0, SURF, M.WOOD, 1);
  }

  const cx = new Float32Array(64), cz = new Float32Array(64);
  for (let k = 0; k < 64; k++) {
    centre(k, C);
    cx[k] = C[0];
    cz[k] = C[1];
  }
  c.chess = { K, T, A, B, U, cx, cz, H: new Float32Array(64) };
  return c;
}

/* ── Per frame ─────────────────────────────────────────────────────────── */

/** The square being laid (1 … 64, fractional) for the plate's progress. */
export function squareAt(p) {
  if (p <= 0.4) return 1 + 31 * (p / 0.4);
  if (p <= 0.62) return 32 + clamp01((p - 0.4) / 0.1);
  return 33 + 31 * clamp01((p - 0.64) / 0.34);
}

/** Re-heights every stack and writes the cloud's positions. */
function restack(c, sq, clipH, cs) {
  const S = c.chess;
  const { K, T, A, B, U, cx, cz, H } = S;
  for (let k = 0; k < 64; k++) {
    const s = k + 1;
    const g = clamp01(sq - (s - 1));
    if (g <= 0) {
      H[k] = -1;
      continue;
    }
    const e = g * g * (3 - 2 * g);
    const h = Math.max(GRAIN, trueHeight(s));
    H[k] = Math.min(clipH, GRAIN + (h - GRAIN) * e);
  }
  const P = c.pos, Ao = c.ao;
  const n = c.n;
  for (let i = 0; i < n; i++) {
    const k = K[i];
    if (k < 0) continue;
    const j = i * 3;
    const h = H[k];
    if (h < 0) {
      P[j] = 1e5;
      continue;
    }
    const x0 = cx[k], z0 = cz[k];
    const t = T[i];
    let x, y, z;
    if (t === T_FACE_X) { x = x0 + HW; y = U[i] * h; z = z0 + A[i]; }
    else if (t === T_FACE_Z) { x = x0 + A[i]; y = U[i] * h; z = z0 + HW; }
    else if (t === T_TOP) { x = x0 + A[i]; y = h; z = z0 + B[i]; }
    else if (t === T_EDGE) { x = x0 + A[i]; y = U[i] * h; z = z0 + B[i]; }
    else if (t === T_RIM) { x = x0 + A[i]; y = h + 0.001; z = z0 + B[i]; }
    else {
      // A course: a band at a fixed rhythm up the stack, only where the stack reaches.
      y = (B[i] + 1) * cs;
      if (y >= h - cs * 0.35) {
        P[j] = 1e5;
        continue;
      }
      if (U[i] > 0.5) { x = x0 + HW * 1.01; z = z0 + A[i]; }
      else { x = x0 + A[i]; z = z0 + HW * 1.01; }
    }
    P[j] = x;
    P[j + 1] = y;
    P[j + 2] = z;
    if (t === T_FACE_X || t === T_FACE_Z) Ao[i] = 1 - 0.4 * Math.exp(-y / 0.05);
  }
}

/* ── The scene ─────────────────────────────────────────────────────────── */

const H0 = 2.5; // the first half's frame height, in metres at the target

export const CHESS = {
  name: "chess",
  figure: "FIG. R.2 — THE SECOND HALF",
  build: buildChess,
  cam: { yaw: 38 * D2R, pitch: 34 * D2R, dist: 7, w: 3.3, wn: 2.55, h: H0, ty: 0.45 },
  fog: [-1.6, 2.4],
  animated: true,
  /** `local`: the section's progress, 0 … 1 (chess.js). */
  motion(t, local, Mx, cam, cloud) {
    const p = clamp01(local);
    const sq = squareAt(p);
    // First half: close on the board; open a little as the staircase climbs.
    const climb = sstep(24, 32, sq);
    let hNow = lerp(1.95, H0, climb);
    let ty = lerp(0.2, 0.45, climb);
    let pitch = 34;
    // The turn: square 33 outgrows the frame; the camera tilts up after it.
    // A phone's squarer plate sees more height for the same width, so it closes in further.
    const narrow = (cam.aspect || 1) < 1.15;
    const turn = sstep(0.44, 0.6, p);
    hNow = lerp(hNow, narrow ? 1.55 : 1.95, turn);
    ty = lerp(ty, narrow ? 0.55 : 0.66, turn);
    pitch = lerp(pitch, 11, turn);
    // Second half: pull back on a long lens and square up to the board, so
    // the far ranks' towers stand file by file, side by side, and leave the frame.
    const back = sstep(0.63, 0.88, p);
    hNow = lerp(hNow, narrow ? 3.2 : 4.2, back);
    ty = lerp(ty, narrow ? 1.35 : 1.75, back);
    pitch = lerp(pitch, 9, back);
    const dist = lerp(cam.dist, 15, back);
    cam.f *= dist / cam.dist;
    cam.dist = dist;
    cam.pitch = pitch * D2R;
    cam.ty = ty;
    cam.f *= H0 / hNow;
    cam.yaw += (-38 * back + 3 * (1 - back) * Math.sin(t * 0.14)) * D2R;
    if (!cloud || !cloud.chess) return;
    // Towers taller than the frame are cut just past its top edge, so their
    // points stay in view. The frame's real height follows fit() (raster.js):
    // a plate is fitted by width or by height, whichever binds.
    const a = cam.aspect || 1;
    const C0 = CHESS.cam;
    const ww = 1 / a > 1.12 ? C0.wn : C0.w;
    const seen = (ww / a > C0.h ? ww / (0.9 * a) : C0.h / 0.9) * (hNow / H0);
    const clipH = ty + seen * 0.62 + 0.3;
    restack(cloud, sq, clipH, hNow / 15);
  },
};

/**
 * FIG. 04 The long game — the closing scene, an homage to the hero.
 *
 * Two men in golf attire on a course: a ground of sparse stipple, two long
 * swells of land, one small flag on a distant green. The page's scroll plays the
 * story through the scene's `local` progress (0 … 1, set on the canvas as
 * `data-p` by golf.js):
 *
 *   0.00–0.07  address      one man addresses the ball, the other watches
 *   0.07–0.31  backswing    the turn, the arms rise, the wrists set
 *   0.31–0.37  downswing    to the ball; it leaves on an arc toward the flag
 *   0.37–0.50  finish       through to a high finish, held
 *   0.50–0.60  release      the club comes down, he turns to his partner
 *   0.60–0.82  walk         they walk together and meet
 *   0.82–1.00  handshake    the hero's handshake: a firm pump, then the hold
 *
 * Built like the other figures (scenes.js): primitive solids and drawn lines
 * sampled into a point cloud, moved per frame by jointed parts. The golfer
 * keeps the hero's proportions and rig in a polo, trousers and golf shoes;
 * it is built here (not imported) so this module depends only on model.js
 * and raster.js. All drawings are original.
 */

import { Model, drain, rankCloud, LINE, SURF } from "./model.js";
import { M } from "./raster.js";

const D2R = Math.PI / 180;
const rad = (d) => d * D2R;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (x) => x * x * (3 - 2 * x);
const sstep = (a, b, x) => ease(clamp01((x - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;

/* ── Affine 3×4 matrices (row-major, translation in 3 · 7 · 11) ───────── */

function mId(o) {
  o.fill(0);
  o[0] = 1;
  o[5] = 1;
  o[10] = 1;
  return o;
}
/** Rotation by a about the unit axis (ax, ay, az) through (px, py, pz). */
function mRot(o, ax, ay, az, a, px, py, pz) {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  o[0] = t * ax * ax + c; o[1] = t * ax * ay - s * az; o[2] = t * ax * az + s * ay;
  o[4] = t * ax * ay + s * az; o[5] = t * ay * ay + c; o[6] = t * ay * az - s * ax;
  o[8] = t * ax * az - s * ay; o[9] = t * ay * az + s * ax; o[10] = t * az * az + c;
  o[3] = px - (o[0] * px + o[1] * py + o[2] * pz);
  o[7] = py - (o[4] * px + o[5] * py + o[6] * pz);
  o[11] = pz - (o[8] * px + o[9] * py + o[10] * pz);
  return o;
}
/** o = A · B. o may not alias A or B. */
function mMul(o, A, B) {
  for (let r = 0; r < 3; r++) {
    const a0 = A[r * 4], a1 = A[r * 4 + 1], a2 = A[r * 4 + 2], a3 = A[r * 4 + 3];
    o[r * 4] = a0 * B[0] + a1 * B[4] + a2 * B[8];
    o[r * 4 + 1] = a0 * B[1] + a1 * B[5] + a2 * B[9];
    o[r * 4 + 2] = a0 * B[2] + a1 * B[6] + a2 * B[10];
    o[r * 4 + 3] = a0 * B[3] + a1 * B[7] + a2 * B[11] + a3;
  }
  return o;
}
function mPut(Mx, p, A) {
  const b = p * 12;
  for (let i = 0; i < 12; i++) Mx[b + i] = A[i];
}
function mLerp(o, A, B, t) {
  for (let i = 0; i < 12; i++) o[i] = A[i] + (B[i] - A[i]) * t;
  return o;
}
function mTrans(o, x, y, z) {
  mId(o);
  o[3] = x;
  o[7] = y;
  o[11] = z;
  return o;
}
/** Uniform scale about a point. */
function mScaleAbout(o, s, px, py, pz) {
  mId(o);
  o[0] = s;
  o[5] = s;
  o[10] = s;
  o[3] = px * (1 - s);
  o[7] = py * (1 - s);
  o[11] = pz * (1 - s);
  return o;
}
/** Applies A to point p into out (out may alias p). */
function mApply(A, p, out) {
  const x = p[0], y = p[1], z = p[2];
  out[0] = A[0] * x + A[1] * y + A[2] * z + A[3];
  out[1] = A[4] * x + A[5] * y + A[6] * z + A[7];
  out[2] = A[8] * x + A[9] * y + A[10] * z + A[11];
  return out;
}
/** Applies A's rotation to direction d into out. */
function mDir(A, d, out) {
  const x = d[0], y = d[1], z = d[2];
  out[0] = A[0] * x + A[1] * y + A[2] * z;
  out[1] = A[4] * x + A[5] * y + A[6] * z;
  out[2] = A[8] * x + A[9] * y + A[10] * z;
  return out;
}
/**
 * The shortest rotation taking direction `from` to direction `to`, about the
 * pivot, with its angle scaled by k (k = 1: all the way).
 */
function mArc(o, from, to, pivot, k = 1) {
  const fl = Math.hypot(from[0], from[1], from[2]) || 1;
  const tl = Math.hypot(to[0], to[1], to[2]) || 1;
  const ax = from[0] / fl, ay = from[1] / fl, az = from[2] / fl;
  const bx = to[0] / tl, by = to[1] / tl, bz = to[2] / tl;
  let cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
  const s = Math.hypot(cx, cy, cz);
  const c = ax * bx + ay * by + az * bz;
  if (s < 1e-9) return mId(o);
  cx /= s; cy /= s; cz /= s;
  return mRot(o, cx, cy, cz, Math.atan2(s, c) * k, pivot[0], pivot[1], pivot[2]);
}

/* ── Modelling helpers ────────────────────────────────────────────────── */

const STAND = 0.95; // the stage's origin sits this high above the ground

/** Moves a built cloud into stage space (ground at −STAND) and ranks it. */
function toStage(cloud) {
  const P = cloud.pos;
  for (let i = 0; i < cloud.n; i++) P[i * 3 + 1] -= STAND;
  rankCloud(cloud);
  return cloud;
}
const st = (q) => [q[0], q[1] - STAND, q[2]];

/** A ground point with a fixed tone (ao) for custom samplers. */
function groundPoint(out, x, y, z, nx, ny, nz, mat, part, ao, kind = SURF) {
  out[0] = x; out[1] = y; out[2] = z;
  out[3] = nx; out[4] = ny; out[5] = nz;
  out[6] = kind; out[7] = mat; out[8] = part; out[9] = 1; out[10] = 0; out[11] = ao;
}

/* ── A golfer: polo shirt, belted trousers, golf shoes ────────────────── */

/**
 * Built facing +x with his right side at +z, then placed at (X, Y, Z) and
 * turned by `yaw` about the vertical (positive swings his front toward −z).
 * The proportions and the rig are the hero's man (scenes.js); the clothes
 * are a short-sleeved polo (collar, placket, bare forearms), tailored
 * trousers with a belt, and golf shoes. `top` and `bottom` are their tones.
 */
function golfer(m, o) {
  const th = o.yaw || 0, X = o.x, Y = o.y || 0, Z = o.z || 0;
  const ct = Math.cos(th), sn = Math.sin(th);
  const W = (x, y, z) => [X + x * ct + z * sn, Y + y, Z - x * sn + z * ct];
  const L = (x, y, z) => {
    const dx = x - X, dz = z - Z;
    return [dx * ct - dz * sn, y - Y, dx * sn + dz * ct];
  };
  const turn = { yaw: th };
  const top = o.top, bottom = o.bottom;
  const P = o.parts;
  const R0 = { part: P.root };
  const HD = { part: P.head ?? P.root };
  const TR = { ...turn, ...R0 };
  const THD = { ...turn, ...HD };

  // The polo: chest and waist, tucked in at the belt.
  const T = [
    [0.005, 1.3, 0, 0.122, 0.2, 0.19],
    [0, 1.1, 0, 0.11, 0.17, 0.168],
  ];
  const frontX = (y, z) => {
    let best = -1;
    for (const e of T) {
      const qy = 1 - ((y - e[1]) / e[4]) ** 2;
      if (qy <= 0) continue;
      const zz = Math.min(Math.abs(z), e[5] * Math.sqrt(qy) * 0.995);
      const q = qy - (zz / e[5]) ** 2;
      best = Math.max(best, e[0] + e[3] * Math.sqrt(Math.max(0, q)));
    }
    return (best < 0 ? 0 : best) + 0.006;
  };
  const tucked = (x, y) => y - Y > 0.995;
  for (const e of T) {
    const c = W(e[0], e[1], e[2]);
    m.ellipsoid(c[0], c[1], c[2], e[3], e[4], e[5], top, { ...TR, keep: tucked });
  }
  const back = W(-0.03, 1.33, 0);
  m.ellipsoid(back[0], back[1], back[2], 0.1, 0.15, 0.188, top, TR);
  m.capsule(W(-0.01, 1.43, -0.18), W(-0.01, 1.43, 0.18), 0.066, 0.066, top, R0);

  // The belt, its buckle; the trousers; golf shoes.
  let p = W(0, 0.995, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.118, 0.026, 0.176, M.TIE_A, TR);
  p = W(0.12, 0.995, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.012, 0.019, 0.024, M.STEEL, TR);
  p = W(-0.005, 0.915, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.118, 0.1, 0.178, bottom, TR);
  o.legs.forEach((g, gi) => {
    const pT = { part: P.thigh[gi] }, pS = { part: P.shin[gi] }, pF = { part: P.foot[gi] };
    m.capsule(W(...g.hip), W(...g.knee), 0.088, 0.068, bottom, pT);
    m.capsule(W(...g.knee), W(...g.ankle), 0.065, 0.056, bottom, pS);
    const sc = W(g.ankle[0] + 0.065, 0.048, g.ankle[2]);
    m.ellipsoid(sc[0], sc[1], sc[2], 0.14, 0.05, 0.052, M.SHOE, { ...turn, ...pF, keep: (x, y) => y > 0.004 });
    m.line([W(g.hip[0] + 0.086, g.hip[1] - 0.13, g.hip[2]), W(g.knee[0] + 0.068, g.knee[1], g.knee[2])], M.DETAIL_SOFT, pT);
    m.line([W(g.knee[0] + 0.068, g.knee[1], g.knee[2]), W(g.ankle[0] + 0.058, g.ankle[1] + 0.05, g.ankle[2])], M.DETAIL_SOFT, pS);
    const brk = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      brk.push(W(g.ankle[0] + Math.cos(a) * 0.063, g.ankle[1] + 0.03 + Math.cos(a) * 0.012, g.ankle[2] + Math.sin(a) * 0.06));
    }
    m.line(brk, M.DETAIL_SOFT, { weight: 0.5, ...pS });
    const welt = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      welt.push(W(g.ankle[0] + 0.065 + Math.cos(a) * 0.142, 0.012, g.ankle[2] + Math.sin(a) * 0.054));
    }
    m.line(welt, M.DETAIL, { weight: 0.8, ...pF });
  });

  // The polo's collar and placket.
  p = W(0.008, 1.5, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.074, 0.036, 0.072, top, TR);
  for (const s of [-1, 1]) {
    m.line([W(0.035, 1.53, s * 0.064), W(frontX(1.455, s * 0.03) + 0.004, 1.455, s * 0.026)], M.DETAIL, R0);
  }
  const placket = [];
  for (let y = 1.462; y >= 1.33; y -= 0.012) placket.push(W(frontX(y, 0), y, 0));
  m.line(placket, M.DETAIL, R0);
  for (const y of [1.425, 1.375]) {
    p = W(frontX(y, 0) + 0.002, y, 0.008);
    m.ellipsoid(p[0], p[1], p[2], 0.008, 0.008, 0.008, M.DETAIL, TR);
  }

  // Neck and head.
  const hx = 0.012, hy = 1.705;
  m.capsule(W(0.012, 1.49, 0), W(hx + 0.01, hy - 0.1, 0), 0.047, 0.045, M.SKIN, HD);
  p = W(hx, hy, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.083, 0.106, 0.07, M.SKIN, THD);
  p = W(hx + 0.034, hy - 0.07, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.064, 0.05, 0.06, M.SKIN, THD);
  p = W(hx + 0.097, hy - 0.015, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.022, 0.028, 0.0135, M.SKIN, THD);
  for (const s of [-1, 1]) {
    p = W(hx - 0.016, hy - 0.01, s * 0.074);
    m.ellipsoid(p[0], p[1], p[2], 0.02, 0.033, 0.012, M.SKIN, THD);
  }
  p = W(hx - 0.02, hy + 0.03, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.09, 0.092, 0.075, M.HAIR, {
    ...THD,
    keep: (x, y, z) => {
      const [lx, ly] = L(x, y, z);
      return ly > hy - 0.05 + Math.max(0, lx - hx + 0.03) * 1.25;
    },
  });

  // Arms: short sleeves, bare forearms.
  o.arms.forEach((a, ai) => {
    const pU = { part: P.ua[ai] }, pA = { part: P.fa[ai] };
    const se = [a.sh[0] + (a.el[0] - a.sh[0]) * 0.46, a.sh[1] + (a.el[1] - a.sh[1]) * 0.46, a.sh[2] + (a.el[2] - a.sh[2]) * 0.46];
    m.capsule(W(...a.sh), W(...se), 0.072, 0.068, top, pU);
    m.capsule(W(...se), W(...a.el), 0.05, 0.045, M.SKIN, pU);
    m.capsule(W(...a.el), W(...a.wr), 0.044, 0.036, M.SKIN, pA);
    const hc = W(a.wr[0] + a.hand[0], a.wr[1] + a.hand[1], a.wr[2] + a.hand[2]);
    m.ellipsoid(hc[0], hc[1], hc[2], a.handR[0], a.handR[1], a.handR[2], M.SKIN, { ...turn, ...pA });
    if (a.thumb) {
      m.capsule(W(a.wr[0] + 0.035, a.wr[1] + 0.02, a.wr[2] + 0.01), W(a.wr[0] + 0.085, a.wr[1] + 0.027, a.wr[2] - 0.005), 0.016, 0.014, M.SKIN, pA);
    }
    // The sleeve's hem.
    const dx = a.el[0] - a.sh[0], dy = a.el[1] - a.sh[1], dz = a.el[2] - a.sh[2];
    const dl = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / dl, uy = dy / dl, uz = dz / dl;
    let qx = -uy, qy = ux;
    const ql = Math.hypot(qx, qy) || 1;
    qx /= ql; qy /= ql;
    const rx = -uz * qy, ry = uz * qx, rz = ux * qy - uy * qx;
    const hem = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2, c = Math.cos(t) * 0.069, s = Math.sin(t) * 0.069;
      hem.push(W(se[0] + qx * c + rx * s, se[1] + qy * c + ry * s, se[2] + rz * s));
    }
    m.line(hem, M.DETAIL, { weight: 0.7, ...pU });
  });

  return {
    W,
    yaw: th,
    centre: [X, Y, Z],
    lateral: [sn, 0, ct],
    forward: [ct, 0, -sn],
    hip: o.legs.map((g) => W(...g.hip)),
    knee: o.legs.map((g) => W(...g.knee)),
    ankle: o.legs.map((g) => W(...g.ankle)),
    sh: o.arms.map((a) => W(...a.sh)),
    el: o.arms.map((a) => W(...a.el)),
    wr: o.arms.map((a) => W(...a.wr)),
    hand: o.arms.map((a) => W(a.wr[0] + a.hand[0], a.wr[1] + a.hand[1], a.wr[2] + a.hand[2])),
  };
}

/** Arms (local, facing +x, right side +z). */
const HANG_R = { sh: [-0.005, 1.425, 0.198], el: [-0.03, 1.125, 0.212], wr: [0.0, 0.875, 0.2], hand: [0.006, -0.07, -0.004], handR: [0.034, 0.072, 0.03] };
const HANG_L = { sh: [-0.005, 1.425, -0.198], el: [-0.03, 1.125, -0.212], wr: [0.0, 0.875, -0.2], hand: [0.006, -0.07, 0.004], handR: [0.034, 0.072, 0.03] };
const SHAKE_ARM = { sh: [-0.005, 1.425, 0.198], el: [0.075, 1.14, 0.165], wr: [0.325, 1.035, 0.055], hand: [0.06, -0.012, -0.02], handR: [0.068, 0.047, 0.036], thumb: true };
const FREE_ARM = { sh: [-0.005, 1.425, -0.198], el: [-0.035, 1.125, -0.215], wr: [-0.005, 0.875, -0.205], hand: [0.005, -0.07, 0.005], handR: [0.034, 0.072, 0.03] };
const legs = () => [
  { hip: [0, 0.93, 0.095], knee: [0.018, 0.5, 0.1], ankle: [0.005, 0.085, 0.1] },
  { hip: [0, 0.93, -0.095], knee: [0.018, 0.5, -0.1], ankle: [0.005, 0.085, -0.1] },
];

/* ── The course ───────────────────────────────────────────────────────── */

/** Two long, low swells of land on the horizon: [z, height, amplitude, frequency, phase]. */
const SWELLS = [
  [-46, 2.2, 1.1, 0.06, 0.8],
  [-68, 4.4, 1.6, 0.04, 2.6],
];
const swellY = (R, x) => R[1] + R[2] * Math.sin(x * R[3] + R[4]) + R[2] * 0.35 * Math.sin(x * R[3] * 2.1 + R[4] * 1.6);

/**
 * The course, at its least: a ground of sparse stipple around the men, two
 * long contours of rolling land on the horizon in the lightest glyph, and
 * one small flag on a distant green. Everything else is paper.
 */
function course(m, g) {
  const dot = (out, x, y, z) => groundPoint(out, x, y, z, 1, 0, 0, M.GRAT, 0, 1, LINE);
  // Ground: a sparse stipple close around the men, thinning to nothing.
  m.custom(0.22, (rand, out) => {
    const a = rand() * Math.PI * 2, r = 3.4 * Math.sqrt(rand());
    const x = g.cx + Math.cos(a) * r * 1.3, z = 0.2 + Math.sin(a) * r * 0.7;
    if (rand() < r / 3.4) return false;
    dot(out, x, 0.001, z);
    return true;
  }, { weight: 1 });
  // Two contours of rolling land, long and clean.
  for (const R of SWELLS) {
    const pts = [];
    for (let x = -60; x <= 60; x += 1) pts.push([x, swellY(R, x), R[0]]);
    m.line(pts, M.GRAT, { weight: 0.045 });
  }
  // The green: a small dotted oval; the pin and its flag.
  const green = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    green.push([g.fx + Math.cos(a) * 3.2, 0.004, g.fz + Math.sin(a) * 1.8]);
  }
  m.line(green, M.GRAT, { weight: 0.2 });
  m.line([[g.fx, 0, g.fz], [g.fx, 2.2, g.fz]], M.STEEL, { weight: 0.5 });
  m.custom(0.07, (rand, out) => {
    let a = rand(), b = rand();
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    groundPoint(out, g.fx + a * 0.85, 2.2 - b * 0.5 - a * 0.25, g.fz + a * 0.1, 0, 0, 1, M.DETAIL, 0, 1);
    return true;
  }, { weight: 1 });
}

/** A soft shadow under a man, carried by one part. */
function shadowUnder(m, cx, cz, part) {
  m.custom(0.5, (rand, out) => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    const x = cx + 0.12 + Math.cos(a) * r * 0.42, z = cz - 0.1 + Math.sin(a) * r * 0.24;
    groundPoint(out, x, 0.002, z, 0, 1, 0, M.GROUND, part, 0.18 + 0.7 * r * r);
    return true;
  }, { weight: 0.5 });
}

/* ── Layout ───────────────────────────────────────────────────────────── */

const TURN_IN = 34 * D2R;
/**
 * Down the line: the golfer faces +x, his right side toward the camera, the
 * target straight away from it (−z). His partner stands opposite his chest,
 * a few metres off and a little back, facing him — clear of the arc and of
 * the ball's line. They meet between them at the clasp, as the hero's men do.
 */
const CLASP = [0, 0, 0.244];
/** Each man's hand offset from his position for a yaw (the hero's shake arm). */
function handOff(yaw) {
  const hx = SHAKE_ARM.wr[0] + SHAKE_ARM.hand[0], hz = SHAKE_ARM.wr[2] + SHAKE_ARM.hand[2];
  return [hx * Math.cos(yaw) + hz * Math.sin(yaw), -hx * Math.sin(yaw) + hz * Math.cos(yaw)];
}
const A_MEET_YAW = -TURN_IN;
const B_MEET_YAW = Math.PI + TURN_IN;
const hA = handOff(A_MEET_YAW), hB = handOff(B_MEET_YAW);
const A_MEET = [CLASP[0] - hA[0] - 0.012, 0, CLASP[2] - hA[1]];
const B_MEET = [CLASP[0] - hB[0] + 0.012, 0, CLASP[2] - hB[1]];
const A_WALK = 1.2; // metres A walks from the tee to the meeting, along +x
const A_TEE = [A_MEET[0] - A_WALK, 0, A_MEET[2]];
const A_REST_YAW = 0; // facing his partner (+x); the target to his left (−z)
const B_FROM = [0.85, 0, -1.2]; // his start, relative to where he meets
const B_WALK = Math.hypot(B_FROM[0], B_FROM[2]);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const B_START = [B_MEET[0] + B_FROM[0], 0, B_MEET[2] + B_FROM[2]];
/** Yaws relative to B's meeting yaw: looking at the golfer, then walking. */
const B_WATCH_YAW = wrapPi(Math.atan2(-(A_TEE[2] - B_START[2]), A_TEE[0] - B_START[0]) - B_MEET_YAW);
const B_HEAD_YAW = wrapPi(Math.atan2(B_FROM[2], -B_FROM[0]) - B_MEET_YAW);
const FLAG_Z = -34;

/* Parts. */
const PA = { root: 1, head: 2, thigh: [3, 4], shin: [5, 6], foot: [7, 8], ua: [9, 10], fa: [11, 12] };
const CLUB = 13, SHADOW_A = 14;
const PB = { root: 15, thigh: [16, 17], shin: [18, 19], foot: [20, 21], ua: [22, 23], fa: [24, 25] };
const BALL = 26;
const TRAIL = [27, 28, 29, 30, 31];

/* ── Build ────────────────────────────────────────────────────────────── */

const BEND0 = rad(27); // the address's forward bend from the hips
const GRIP_LOCAL = [0.288, 1.0, 0]; // hands at address, before the bend (local)
const CLUB_LEN = 0.96;

function* stepsGolf(n) {
  const m = new Model(41, 0.002);
  m.aoScale = 0.06;

  // The golfer: a dark polo, light trousers. His partner: a light polo, dark trousers.
  const A = golfer(m, { x: A_TEE[0], z: A_TEE[2], yaw: A_REST_YAW, top: M.SUIT_B, bottom: M.CHAIR, legs: legs(), arms: [HANG_R, HANG_L], parts: PA });
  const B = golfer(m, { x: B_MEET[0], z: B_MEET[2], yaw: B_MEET_YAW, top: M.CHAIR, bottom: M.SUIT_A, legs: legs(), arms: [SHAKE_ARM, FREE_ARM], parts: PB });
  shadowUnder(m, A_TEE[0], A_TEE[2], SHADOW_A);
  shadowUnder(m, B_MEET[0], B_MEET[2], PB.root);

  // A's address: each arm turned at its shoulder so both hands meet at the grip.
  const G = A.W(...GRIP_LOCAL);
  const addr = [0, 1].map((i) => {
    const o = new Float64Array(12);
    const sh = A.sh[i];
    return mArc(o, [A.wr[i][0] - sh[0], A.wr[i][1] - sh[1], A.wr[i][2] - sh[2]], [G[0] - sh[0], G[1] - sh[1], G[2] - sh[2]], sh);
  });
  const hipC = A.W(0, 0.93, 0);
  const bend0 = new Float64Array(12);
  mRot(bend0, A.lateral[0], A.lateral[1], A.lateral[2], -BEND0, hipC[0], hipC[1], hipC[2]);
  const unbend0 = new Float64Array(12);
  mRot(unbend0, A.lateral[0], A.lateral[1], A.lateral[2], BEND0, hipC[0], hipC[1], hipC[2]);
  // The grip (the hands' centre at address) and the ball, a club's length away on the ground.
  const gripTop = mApply(addr[0], A.hand[0], [0, 0, 0]);
  const gripBent = mApply(bend0, gripTop, [0, 0, 0]);
  const f = A.forward;
  const drop = gripBent[1] - 0.021;
  const reach = Math.sqrt(Math.max(0.05, CLUB_LEN * CLUB_LEN - drop * drop));
  const ball = [gripBent[0] + f[0] * reach, 0.021, gripBent[2] + f[2] * reach];
  // The club, modelled at address in the unbent frame: grip, shaft, head behind the ball.
  const headRest = mApply(unbend0, [ball[0] - f[0] * 0.02, 0.03, ball[2] - f[2] * 0.02], [0, 0, 0]);
  const dir = [headRest[0] - gripTop[0], headRest[1] - gripTop[1], headRest[2] - gripTop[2]];
  const dl = Math.hypot(dir[0], dir[1], dir[2]);
  const du = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  const along = (t) => [gripTop[0] + du[0] * t, gripTop[1] + du[1] * t, gripTop[2] + du[2] * t];
  const CP = { part: CLUB };
  m.capsule(along(-0.03), along(0.24), 0.019, 0.016, M.SHOE, CP);
  m.line([along(0.24), along(dl - 0.04)], M.STEEL, { weight: 2.2, ...CP });
  const hd = along(dl - 0.01);
  m.ellipsoid(hd[0], hd[1], hd[2], 0.05, 0.03, 0.045, M.STEEL, { ...CP, cull: false });
  m.line([along(dl - 0.05), [hd[0] - A.lateral[0] * 0.05, hd[1] - 0.012, hd[2] - A.lateral[2] * 0.05]], M.DETAIL, { weight: 0.3, ...CP });
  // The ball, and its flight: a dotted arc to the green, in parts so it is drawn as it is flown.
  m.ellipsoid(ball[0], ball[1], ball[2], 0.03, 0.03, 0.03, M.DETAIL, { part: BALL, cull: false });
  const FLAG = [ball[0] + 2.4, 0, FLAG_Z];
  const land = [FLAG[0] - 0.6, 0.03, FLAG[2] + 1.4];
  const flight = (s) => {
    const e = 1 - Math.pow(1 - s, 1.7);
    return [lerp(ball[0], land[0], e), lerp(ball[1], land[1], s) + 4.6 * Math.sin(Math.PI * Math.pow(s, 0.8)), lerp(ball[2], land[2], e)];
  };
  TRAIL.forEach((part, i) => {
    const pts = [];
    const s0 = i / TRAIL.length, s1 = (i + 1) / TRAIL.length;
    for (let k = 0; k <= 16; k++) pts.push(flight(lerp(s0, s1, k / 16)));
    m.line(pts, M.GRAT, { part, weight: 0.3 });
  });

  course(m, { cx: (A_TEE[0] + B_START[0]) / 2, fx: FLAG[0], fz: FLAG[2] });

  // B's own club, in his left hand, its head resting on the ground before him.
  const bh = B.hand[1], bf = B.forward;
  const bHead = [bh[0] + bf[0] * 0.14 - B.lateral[0] * 0.1, 0.035, bh[2] + bf[2] * 0.14 - B.lateral[2] * 0.1];
  const BP = { part: PB.fa[1] };
  const bdir = [bHead[0] - bh[0], bHead[1] - bh[1], bHead[2] - bh[2]];
  const bl = Math.hypot(bdir[0], bdir[1], bdir[2]);
  const bAt = (t) => [bh[0] + (bdir[0] / bl) * t, bh[1] + (bdir[1] / bl) * t, bh[2] + (bdir[2] / bl) * t];
  m.capsule(bAt(-0.03), bAt(0.22), 0.019, 0.016, M.SHOE, BP);
  m.line([bAt(0.22), bAt(bl - 0.03)], M.STEEL, { weight: 2.2, ...BP });
  m.ellipsoid(bHead[0], bHead[1], bHead[2], 0.05, 0.03, 0.045, M.STEEL, { ...BP, cull: false });

  // A's carry: the club in his left hand, hanging along his leg.
  const lh = A.hand[1];
  const carryDir = [f[0] * 0.22 - A.lateral[0] * 0.04, -1, f[2] * 0.22 - A.lateral[2] * 0.04];
  const carry = new Float64Array(12), carryR = new Float64Array(12), carryT = new Float64Array(12);
  mArc(carryR, du, carryDir, gripTop);
  mTrans(carryT, lh[0] - gripTop[0], lh[1] + 0.02 - gripTop[1], lh[2] - gripTop[2]);
  mMul(carry, carryT, carryR);

  // A's handshake arm, from hanging to the hero's shake (in his rest frame).
  const shake = {
    el: A.W(...SHAKE_ARM.el),
    wr: A.W(...SHAKE_ARM.wr),
  };

  const c = yield* m.steps(n, 0.04);

  const S = (q) => st(q);
  c.golf = {
    A: {
      centre: S(A.centre), lateral: A.lateral, forward: f,
      // The swing plane's normal: forward, tilted up, so the plane holds the
      // target line and rises from the ball back through the shoulders.
      plane: [f[0] * Math.cos(rad(34)), Math.sin(rad(34)), f[2] * Math.cos(rad(34))],
      hipC: S(hipC), hub: S(A.W(-0.005, 1.425, 0)), grip: S(gripTop),
      hip: A.hip.map(S), knee: A.knee.map(S), ankle: A.ankle.map(S),
      sh: A.sh.map(S), el: A.el.map(S), wr: A.wr.map(S),
      shakeEl: S(shake.el), shakeWr: S(shake.wr),
      addr: addr.map((o) => stageMat(o)), carry: stageMat(carry),
    },
    B: {
      centre: S(B.centre), lateral: B.lateral,
      hip: B.hip.map(S), knee: B.knee.map(S), ankle: B.ankle.map(S),
      sh: B.sh.map(S), el: B.el.map(S),
    },
    ball: S(ball),
    flight: (s, out) => {
      const p = flight(s);
      out[0] = p[0]; out[1] = p[1] - STAND; out[2] = p[2];
      return out;
    },
    trailStart: TRAIL.map((_, i) => S(flight(i / TRAIL.length))),
  };
  return toStage(c);
}

/** A world-space matrix re-expressed in stage space (y shifted by −STAND). */
function stageMat(o) {
  const T = new Float64Array(12), Ti = new Float64Array(12), a = new Float64Array(12), out = new Float64Array(12);
  mTrans(T, 0, -STAND, 0);
  mTrans(Ti, 0, STAND, 0);
  mMul(a, o, Ti);
  return mMul(out, T, a);
}

/* ── Motion ───────────────────────────────────────────────────────────── */

/* Scratch, so a frame allocates nothing. */
const T1 = new Float64Array(12), T2 = new Float64Array(12), T3 = new Float64Array(12), T4 = new Float64Array(12);
const BEND = new Float64Array(12), HEADM = new Float64Array(12), TURN_A = new Float64Array(12), WROOT = new Float64Array(12);
const LIFT = new Float64Array(12), HINGE = new Float64Array(12);
const BODY = new Float64Array(12), ARMS = new Float64Array(12), ROOT = new Float64Array(12);
const SW = [new Float64Array(12), new Float64Array(12)];
const WK = [new Float64Array(12), new Float64Array(12)];
const LEG = new Float64Array(12), SHIN = new Float64Array(12), FOOT = new Float64Array(12);
const UA = new Float64Array(12), FA = new Float64Array(12), CL = new Float64Array(12), CLW = new Float64Array(12);
const V1 = [0, 0, 0], V2 = [0, 0, 0], V3 = [0, 0, 0], V4 = [0, 0, 0];

/** Monotone keyframe curve: keys [[u, v], …], eased between keys. */
function curve(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [u1, v1, e] = keys[i];
    if (u <= u1) {
      const [u0, v0] = keys[i - 1];
      let x = (u - u0) / (u1 - u0);
      x = e === "in" ? x * x * x : e === "out" ? 1 - Math.pow(1 - x, 2.4) : e === "lin" ? x : ease(x);
      return v0 + (v1 - v0) * x;
    }
  }
  return keys[keys.length - 1][1];
}

/* The swing, in degrees: λ the arms' arc (+ back), ψ the wrists' set, τ the body's turn (+ through), β the bend. */
const K_LIFT = [[0.07, 0], [0.31, 148], [0.33, 148], [0.37, -4, "in"], [0.47, -140, "out"], [0.505, -140], [0.585, 0]];
const K_HINGE = [[0.07, 0], [0.31, 104], [0.33, 104], [0.37, -2, "in"], [0.47, -118, "out"], [0.505, -118], [0.585, 0]];
const K_TURN = [[0.07, 0], [0.31, -84], [0.33, -84], [0.37, 16, "in"], [0.47, 94, "out"], [0.505, 94], [0.585, 0]];
const K_BEND = [[0.07, 27], [0.31, 25], [0.37, 25], [0.47, 7], [0.585, 0]];
const K_KNEE = [[0.07, 1], [0.37, 1], [0.47, 0.35], [0.585, 0]];
const SWING_END = 0.585; // the swing's frame gives way to the walk's
const BLEND_END = 0.62;
const WALK0 = 0.62, WALK1 = 0.82;
const IMPACT = 0.37, LANDED = 0.62;

/** A man's legs: planted with a flex, or walking (phase w, amplitude amp). */
function legsPose(Mx, R, parent, P, flex, w, amp) {
  const lat = R.lateral;
  for (let g = 0; g < 2; g++) {
    const ph = w + (g ? Math.PI : 0);
    const hip = 0.24 * flex + 0.38 * amp * Math.sin(ph);
    const knee = 0.46 * flex + amp * (0.07 + 0.92 * Math.pow(Math.max(0, Math.cos(ph - 0.35)), 1.6));
    const ankle = -(hip - knee) * 0.82 - 0.18 * amp * Math.max(0, -Math.sin(ph));
    mRot(T1, lat[0], lat[1], lat[2], hip, R.hip[g][0], R.hip[g][1], R.hip[g][2]);
    mMul(LEG, parent, T1);
    mPut(Mx, P.thigh[g], LEG);
    mRot(T1, lat[0], lat[1], lat[2], -knee, R.knee[g][0], R.knee[g][1], R.knee[g][2]);
    mMul(SHIN, LEG, T1);
    mPut(Mx, P.shin[g], SHIN);
    mRot(T1, lat[0], lat[1], lat[2], ankle, R.ankle[g][0], R.ankle[g][1], R.ankle[g][2]);
    mMul(FOOT, SHIN, T1);
    mPut(Mx, P.foot[g], FOOT);
  }
}

/** The swing's body (bend · turn about the hips) into `o`; `share` of the turn. */
function swingBody(o, R, bend, turn, share) {
  mRot(BEND, R.lateral[0], R.lateral[1], R.lateral[2], -rad(bend), R.hipC[0], R.hipC[1], R.hipC[2]);
  mRot(T2, 0, 1, 0, rad(turn) * share, R.hipC[0], 0, R.hipC[2]);
  return mMul(o, BEND, T2);
}

/** Golfer A: the swing, the release, the walk, the handshake. */
function poseA(Mx, R, u, t, pump) {
  if (u >= BLEND_END) {
    walkFrame(Mx, R, clamp01((u - WALK0) / (WALK1 - WALK0)), t, pump, true);
    return;
  }
  // ── The swing's frame.
  const lam = curve(K_LIFT, u), psi = curve(K_HINGE, u), tau = curve(K_TURN, u), bend = curve(K_BEND, u);
  const late = sstep(0.47, SWING_END, u);
  const waggle = u < 0.07 ? 3 * Math.sin(t * 1.6) * (1 - u / 0.07) : 0;
  swingBody(HEADM, R, bend, tau * lerp(0.42, 1, late), 1);
  swingBody(BODY, R, bend, tau, 1);
  // Arms: the bend and a share of the turn, then the arc about the hub, in a
  // plane facing the camera (tilted with the bend).
  swingBody(TURN_A, R, bend, tau, lerp(0.35, 1, late));
  mApply(TURN_A, R.hub, V1);
  const n = R.plane;
  mRot(LIFT, n[0], n[1], n[2], -rad(lam + waggle * 0.3), V1[0], V1[1], V1[2]);
  mMul(ARMS, LIFT, TURN_A);
  mMul(SW[0], ARMS, R.addr[0]);
  mMul(SW[1], ARMS, R.addr[1]);
  // The club: the wrists set about the hands, in the same plane.
  mApply(ARMS, R.grip, V3);
  mRot(HINGE, n[0], n[1], n[2], -rad(psi + waggle), V3[0], V3[1], V3[2]);
  mMul(CL, HINGE, ARMS);
  const flex = curve(K_KNEE, u);
  if (u < SWING_END) {
    mPut(Mx, PA.root, BODY);
    mPut(Mx, PA.head, HEADM);
    for (let i = 0; i < 2; i++) {
      mPut(Mx, PA.ua[i], SW[i]);
      mPut(Mx, PA.fa[i], SW[i]);
    }
    mPut(Mx, CLUB, CL);
    mId(ROOT);
    legsPose(Mx, R, ROOT, PA, flex, 0, 0);
    mPut(Mx, SHADOW_A, mId(T4));
    return;
  }
  // ── Into the walk's frame: the same moment expressed as a turned root,
  // the club passing from both hands to the left.
  const e = sstep(SWING_END, BLEND_END, u);
  walkFrame(Mx, R, 0, t, pump, false);
  mPut(Mx, PA.root, mLerp(T4, BODY, WROOT, e));
  mPut(Mx, PA.head, mLerp(T4, HEADM, WROOT, e));
  mLerp(T4, SW[0], WK[0], e);
  mPut(Mx, PA.ua[0], T4);
  mPut(Mx, PA.fa[0], T4);
  mLerp(T4, SW[1], WK[1], e);
  mPut(Mx, PA.ua[1], T4);
  mPut(Mx, PA.fa[1], T4);
  mPut(Mx, CLUB, mLerp(T4, CL, CLW, e));
  mId(ROOT);
  legsPose(Mx, R, ROOT, PA, flex * (1 - e), 0, 0);
  mPut(Mx, SHADOW_A, mId(T4));
}

/**
 * A in the walk's frame: turned toward his partner, walking s (0 … 1) of the
 * way, his right arm rising to the hero's shake as he arrives, the club
 * carried in his left hand. Leaves the root in WROOT, the arms in WK and the
 * club in CLW; writes the parts when `write`.
 */
function walkFrame(Mx, R, s, t, pump, write) {
  const travel = s * (2 - s);
  const amp = sstep(0, 0.1, s) * (1 - sstep(0.72, 1, s));
  const k = sstep(0.62, 1, s);
  const w = 2 * Math.PI * (0.2 + (A_WALK * travel) / 1.26);
  // Root: from facing the camera to facing his partner, then the handshake's three-quarter.
  const yaw = A_MEET_YAW * sstep(0.55, 1, s);
  mRot(WROOT, 0, 1, 0, yaw, R.centre[0], 0, R.centre[2]);
  WROOT[3] += A_WALK * travel;
  WROOT[7] += 0.016 * amp * (Math.cos(2 * w) - 1) * 0.5;
  const lat = R.lateral;
  // Right arm: a walking swing, then the arc up to the shake.
  mRot(T1, lat[0], lat[1], lat[2], -0.3 * amp * Math.sin(w) * (1 - k), R.sh[0][0], R.sh[0][1], R.sh[0][2]);
  V1[0] = R.el[0][0] - R.sh[0][0]; V1[1] = R.el[0][1] - R.sh[0][1]; V1[2] = R.el[0][2] - R.sh[0][2];
  V2[0] = R.shakeEl[0] - R.sh[0][0]; V2[1] = R.shakeEl[1] - R.sh[0][1]; V2[2] = R.shakeEl[2] - R.sh[0][2];
  mArc(T2, V1, V2, R.sh[0], k);
  mMul(T3, T2, T1);
  mMul(WK[0], WROOT, T3);
  // Forearm: turned at the (raised) elbow onto the shake's line, then the pump.
  mApply(T3, R.el[0], V3);
  V4[0] = R.wr[0][0] - R.el[0][0]; V4[1] = R.wr[0][1] - R.el[0][1]; V4[2] = R.wr[0][2] - R.el[0][2];
  mDir(T3, V4, V1);
  V2[0] = R.shakeWr[0] - R.shakeEl[0]; V2[1] = R.shakeWr[1] - R.shakeEl[1]; V2[2] = R.shakeWr[2] - R.shakeEl[2];
  mArc(T1, V1, V2, V3, k);
  mRot(T2, lat[0], lat[1], lat[2], pump, V3[0], V3[1], V3[2]);
  mMul(T4, T2, T1);
  mMul(T1, T4, T3);
  mMul(FA, WROOT, T1);
  // Left arm: a walking swing, holding the club.
  mRot(T1, lat[0], lat[1], lat[2], -0.24 * amp * Math.sin(w + Math.PI), R.sh[1][0], R.sh[1][1], R.sh[1][2]);
  mMul(WK[1], WROOT, T1);
  mMul(CLW, WK[1], R.carry);
  if (!write) return;
  mPut(Mx, PA.root, WROOT);
  mPut(Mx, PA.head, WROOT);
  legsPose(Mx, R, WROOT, PA, 0, w, amp);
  mPut(Mx, PA.ua[0], WK[0]);
  mPut(Mx, PA.fa[0], FA);
  mPut(Mx, PA.ua[1], WK[1]);
  mPut(Mx, PA.fa[1], WK[1]);
  mPut(Mx, CLUB, CLW);
  mPut(Mx, SHADOW_A, mTrans(T4, A_WALK * travel, 0, 0));
}

/** B: watching from behind the tee, then walking forward to the handshake (built in it, like the hero's men). */
function poseB(Mx, R, s, t, pump) {
  const travel = s * (2 - s);
  const amp = sstep(0, 0.1, s) * (1 - sstep(0.72, 1, s));
  const k = sstep(0.62, 1, s);
  const w = 2 * Math.PI * (0.7 + (B_WALK * travel) / 1.26);
  const lat = R.lateral;
  // Root: looking at the golfer, turning onto his path, then into the handshake's three-quarter.
  const dYaw = lerp(B_WATCH_YAW, B_HEAD_YAW, sstep(0, 0.22, s)) * (1 - sstep(0.55, 1, s));
  mRot(ROOT, 0, 1, 0, dYaw, R.centre[0], 0, R.centre[2]);
  const rem = 1 - travel;
  ROOT[3] += B_FROM[0] * rem;
  ROOT[11] += B_FROM[2] * rem;
  ROOT[7] += 0.016 * amp * (Math.cos(2 * w) - 1) * 0.5 + 0.004 * Math.sin(t * 1.3) * (1 - amp);
  mPut(Mx, PB.root, ROOT);
  legsPose(Mx, R, ROOT, PB, 0, w, amp);
  // Arms: the shaking arm hangs and swings, then rises to the clasp.
  const swing0 = -0.32 * amp * Math.sin(w);
  const swing1 = -0.32 * amp * Math.sin(w + Math.PI);
  mRot(T1, lat[0], lat[1], lat[2], (swing0 - 0.27) * (1 - k), R.sh[0][0], R.sh[0][1], R.sh[0][2]);
  mMul(UA, ROOT, T1);
  mPut(Mx, PB.ua[0], UA);
  mRot(T1, lat[0], lat[1], lat[2], (-0.63 + 0.12 * Math.max(0, swing0)) * (1 - k) + pump, R.el[0][0], R.el[0][1], R.el[0][2]);
  mMul(FA, UA, T1);
  mPut(Mx, PB.fa[0], FA);
  mRot(T1, lat[0], lat[1], lat[2], swing1, R.sh[1][0], R.sh[1][1], R.sh[1][2]);
  mMul(UA, ROOT, T1);
  mPut(Mx, PB.ua[1], UA);
  mRot(T1, lat[0], lat[1], lat[2], 0.08 + 0.1 * amp * Math.max(0, swing1), R.el[1][0], R.el[1][1], R.el[1][2]);
  mMul(FA, UA, T1);
  mPut(Mx, PB.fa[1], FA);
}

/** The ball: on the tee, then flown along its arc; the trail drawn behind it. */
function poseBall(Mx, G, u) {
  const s = clamp01((u - IMPACT) / (LANDED - IMPACT));
  if (s <= 0) mPut(Mx, BALL, mId(T1));
  else {
    G.flight(s, V4);
    mPut(Mx, BALL, mTrans(T1, V4[0] - G.ball[0], V4[1] - G.ball[1], V4[2] - G.ball[2]));
  }
  const n = TRAIL.length;
  // Once the ball is down, its arc clears from the tee outward.
  const gone = sstep(LANDED, LANDED + 0.1, u) * n;
  for (let i = 0; i < n; i++) {
    const g = i + 1 <= gone + 1e-6 ? 0 : clamp01(s * n - i);
    const p = G.trailStart[i];
    if (g <= 0.001) mTrans(T1, 0, -1000, 0);
    else mScaleAbout(T1, g, p[0], p[1], p[2]);
    mPut(Mx, TRAIL[i], T1);
  }
}

/* ── The scene ────────────────────────────────────────────────────────── */

export const GOLF = {
  name: "golf",
  figure: "FIG. 04 — THE LONG GAME",
  build: (n) => drain(stepsGolf(n)),
  steps: stepsGolf,
  cam: { yaw: rad(0), pitch: rad(5), dist: 5.2, w: 3.35, wn: 1.8, h: 2.3, ty: 0.22 },
  fog: [-1.2, 7.5],
  focus: [0, 0.1, 0],
  animated: true,
  /** `local`: the section's scroll, 0 … 1 — the swing, the walk, the handshake. */
  motion(t, local, Mx, cam, cloud) {
    const u = clamp01(local);
    const G = cloud && cloud.golf;
    const narrow = (cam.aspect || 1) < 0.9;
    // The camera turns with the story, from the golfer's front to the handshake's three-quarter.
    cam.yaw += rad(lerp(-5, 7, sstep(0.08, 0.95, u))) + rad(1.5) * Math.sin(t * 0.17);
    cam.pitch += rad(lerp(1.5, -0.5, u)) + rad(0.5) * Math.sin(t * 0.11 + 1);
    // Framing: the golfer and his partner (on a phone, the golfer), then the pair, closer.
    const startX = narrow ? A_TEE[0] + 0.3 : (A_TEE[0] + B_START[0]) / 2 - 0.22;
    cam.tx = lerp(startX, CLASP[0] - 0.04, sstep(0.5, 0.86, u));
    cam.f *= lerp(1, narrow ? 0.98 : 1.22, sstep(0.55, 0.92, u));
    if (!G) return;
    const pu = clamp01((u - 0.84) / 0.11);
    const pump = 0.11 * Math.sin(pu * Math.PI * 4) * (1 - pu * 0.4) * (pu > 0 && pu < 1 ? 1 : 0) + 0.02 * Math.sin(t * 2 * Math.PI * 0.42) * sstep(0.95, 1, u);
    poseA(Mx, G.A, u, t, pump);
    poseB(Mx, G.B, clamp01((u - WALK0) / (WALK1 - WALK0)), t, pump);
    poseBall(Mx, G, u);
  },
};

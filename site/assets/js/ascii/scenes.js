/**
 * The figures.
 *
 * FIG. 01 Partnership — after the album cover, drawn new: two men in dark
 *   suits walk in across an open lot, meet and shake hands; scroll walks them.
 * FIG. 02 The decade — the world: Natural Earth 1:50m coasts drawn as lines,
 *   NASA relief for the land's tone, India in its official boundary a step
 *   darker and facing; routes leaving it, two orbits turning.
 * FIG. 03 The work — a tower crane beside a skyscraper that rises floor by
 *   floor with the scroll.
 * FIG. 04 A seat at the table — a man seated at a meeting table; the chair
 *   opposite is empty and turned out.
 *
 * Each figure is modelled in metres (the globe in radii), sampled into a
 * cloud and moved into stage space: centred, two units tall, so any figure's
 * matter can travel into any other's. All drawings are original.
 */

import { Model, drain, rankCloud, LINE, SURF } from "./model.js";
import { M, keyLight } from "./raster.js";
import { INDIA, LAND_BITS, LAND_H, LAND_W } from "./land.js";
import { RELIEF_BITS, RELIEF_H, RELIEF_W } from "./relief.js";
import { GOLF } from "./golf-scene.js";

const D2R = Math.PI / 180;
/** Each figure's resting camera yaw (its light is set from it). */
const SCENE_YAW = { partnership: 6 * D2R, decade: 0, work: 36 * D2R, table: 26 * D2R };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Pacing. Each chapter holds its figure for the first HOLD of its scroll; the
 * rest is the change into the next. Scenes read `v`, their own progress: 0 at
 * the chapter's start, HOLD at the end of its hold, 1 where the next chapter
 * begins (negative while the change into this figure is still under way).
 */
export const HOLD = 0.45;

/**
 * The camera's path, in degrees of yaw against v. Every figure turns with the
 * scroll, always the same way, so the story never stands still and a change is
 * part of one continuous movement. The globe turns its own land instead (it
 * faces the camera, so the camera's yaw is free there): that lets the path
 * fall back during the globe's hold and rise again into the work.
 */
const YAW = {
  partnership: (v) => -14 + 56 * v,
  decade: (v) => (v <= 0 ? 42 + 20 * v : v <= HOLD ? 42 - (46 * v) / HOLD : -4 + 10 * (v - HOLD)),
  work: (v) => 20 + 32 * v,
};

/* ── Part matrices ─────────────────────────────────────────────────────── */

export const PARTS = 32;
export function identity(Mx, p) {
  const b = p * 12;
  Mx.fill(0, b, b + 12);
  Mx[b] = 1;
  Mx[b + 5] = 1;
  Mx[b + 10] = 1;
}
function translate(Mx, p, x, y, z) {
  identity(Mx, p);
  const b = p * 12;
  Mx[b + 3] = x;
  Mx[b + 7] = y;
  Mx[b + 11] = z;
}
/** Rotation by angle a about a unit axis through a pivot, then a translation. */
function rotate(Mx, p, ax, ay, az, a, px, py, pz, tx = 0, ty = 0, tz = 0) {
  const b = p * 12;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  const m00 = t * ax * ax + c, m01 = t * ax * ay - s * az, m02 = t * ax * az + s * ay;
  const m10 = t * ax * ay + s * az, m11 = t * ay * ay + c, m12 = t * ay * az - s * ax;
  const m20 = t * ax * az - s * ay, m21 = t * ay * az + s * ax, m22 = t * az * az + c;
  Mx[b] = m00; Mx[b + 1] = m01; Mx[b + 2] = m02;
  Mx[b + 4] = m10; Mx[b + 5] = m11; Mx[b + 6] = m12;
  Mx[b + 8] = m20; Mx[b + 9] = m21; Mx[b + 10] = m22;
  Mx[b + 3] = px - (m00 * px + m01 * py + m02 * pz) + tx;
  Mx[b + 7] = py - (m10 * px + m11 * py + m12 * pz) + ty;
  Mx[b + 11] = pz - (m20 * px + m21 * py + m22 * pz) + tz;
}

/* ── Shared modelling ──────────────────────────────────────────────────── */

/** Moves a built cloud into stage space: (p − c) · s. */
function toStage(cloud, cx, cy, cz, s) {
  const P = cloud.pos;
  for (let i = 0; i < cloud.n; i++) {
    P[i * 3] = (P[i * 3] - cx) * s;
    P[i * 3 + 1] = (P[i * 3 + 1] - cy) * s;
    P[i * 3 + 2] = (P[i * 3 + 2] - cz) * s;
  }
  if (cloud.alt) {
    const A = cloud.alt;
    for (let i = 0; i < cloud.n; i++) {
      A[i * 3] = (A[i * 3] - cx) * s;
      A[i * 3 + 1] = (A[i * 3 + 1] - cy) * s;
      A[i * 3 + 2] = (A[i * 3 + 2] - cz) * s;
    }
  }
  rankCloud(cloud);
  return cloud;
}

/** A flat panel (both faces) sampled as a surface: centre, half-axes u and v. */
function panel(m, c, u, v, mat, o = {}) {
  const area = 4 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  m.custom(area * (o.weight ?? 1), (rand, out) => {
    const a = rand() * 2 - 1, b = rand() * 2 - 1;
    out[0] = c[0] + u[0] * a + v[0] * b;
    out[1] = c[1] + u[1] * a + v[1] * b;
    out[2] = c[2] + u[2] * a + v[2] * b;
    const f = o.oneSided || rand() < 0.5 ? 1 : -1;
    out[3] = nx * f; out[4] = ny * f; out[5] = nz * f;
    out[6] = SURF; out[7] = mat; out[8] = o.part || 0; out[9] = 1; out[10] = 0;
    out[11] = o.ao ?? 1;
  });
}

/** A rectangle outline as a closed line. */
function rect(m, c, u, v, mat, o) {
  const p = (a, b) => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, c[2] + u[2] * a + v[2] * b];
  m.line([p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), p(-1, -1)], mat, o);
}

/* ── A man in a suit ───────────────────────────────────────────────────── */

/**
 * A man in a two-button suit, built facing +x with his right side at +z,
 * then placed at (X, Y, Z) and turned by `yaw` about the vertical (0 faces
 * +x; a positive turn swings his front toward −z). Seven and a half heads
 * tall.
 */
function man(m, o) {
  const th = o.yaw || 0, X = o.x, Y = o.y || 0, Z = o.z || 0;
  const ct = Math.cos(th), st = Math.sin(th);
  const W = (x, y, z) => [X + x * ct + z * st, Y + y, Z - x * st + z * ct];
  const L = (x, y, z) => {
    const dx = x - X, dz = z - Z;
    return [dx * ct - dz * st, y - Y, dx * st + dz * ct];
  };
  const turn = { yaw: th };
  const suit = o.suit, tie = o.tie;
  const seated = !!o.seated;
  // Parts: a rigged man moves by joint; an unrigged one is still.
  const P = o.parts || { root: 0, thigh: [0, 0], shin: [0, 0], foot: [0, 0], ua: [0, 0], fa: [0, 0] };
  const R0 = { part: P.root };

  // Key heights (standing; the seated pose lowers the trunk).
  const drop = seated ? -0.4 : 0;
  const lean = seated ? 0.04 : 0;
  const yCollar = 1.47 + drop, yButton = 1.085 + drop, yButton2 = 0.965 + drop, yHem = 0.785 + drop;

  // The jacket's three volumes (local), for the front-surface helper.
  const J = [
    [lean, 1.3 + drop, 0, 0.13, 0.205, 0.2],
    [lean * 0.5, 1.06 + drop, 0, 0.118, 0.24, 0.182],
    [-0.005, 0.9 + drop, 0, 0.128, 0.125, 0.195],
  ];
  // The jacket's front surface at (y, z), held to the cloth's edge where z runs past it.
  const frontX = (y, z) => {
    let best = -1;
    for (const e of J) {
      const qy = 1 - ((y - e[1]) / e[4]) ** 2;
      if (qy <= 0) continue;
      const zz = Math.min(Math.abs(z), e[5] * Math.sqrt(qy) * 0.995);
      const q = qy - (zz / e[5]) ** 2;
      best = Math.max(best, e[0] + e[3] * Math.sqrt(Math.max(0, q)));
    }
    return (best < 0 ? 0 : best) + 0.006;
  };
  const vHalf = (y) => 0.085 * clamp01((y - yButton) / (yCollar - yButton));
  const tieHalf = (y) => (y > yCollar - 0.05 ? 0.022 : 0.016 + 0.018 * clamp01((yCollar - 0.05 - y) / 0.3));

  const jacketMat = (x, y, z, nx, ny, nz) => {
    const [lx, ly, lz] = L(x, y, z);
    const lnx = nx * ct - nz * st;
    if (lnx > 0.25 && ly > yButton - 0.01 && ly < yCollar + 0.02) {
      if (Math.abs(lz) < tieHalf(ly)) return tie;
      if (Math.abs(lz) < vHalf(ly)) return M.SHIRT;
    }
    if (lnx > 0.6 && Math.abs(lz) < 0.013 && (Math.abs(ly - yButton) < 0.013 || Math.abs(ly - yButton2) < 0.013)) return M.DETAIL;
    return suit;
  };
  const keepHem = (x, y) => y - Y > yHem - 0.005;

  // Jacket.
  for (const e of J) {
    const c = W(e[0], e[1], e[2]);
    m.ellipsoid(c[0], c[1], c[2], e[3], e[4], e[5], suit, { ...turn, ...R0, matFn: jacketMat, keep: keepHem });
  }
  const back = W(-0.035, 1.34 + drop, 0);
  m.ellipsoid(back[0], back[1], back[2], 0.105, 0.15, 0.198, suit, { ...turn, ...R0 });
  m.capsule(W(-0.01 + lean, 1.43 + drop, -0.19), W(-0.01 + lean, 1.43 + drop, 0.19), 0.072, 0.072, suit, R0);

  // Trousers, legs and shoes.
  const seat = W(-0.01, 0.89 + drop * 0.95, 0);
  m.ellipsoid(seat[0], seat[1], seat[2], 0.115, 0.1, 0.175, suit, { ...turn, ...R0 });
  const legs = o.legs;
  const lw = o.legWeight ?? 1;
  legs.forEach((g, gi) => {
    const pT = { part: P.thigh[gi] }, pS = { part: P.shin[gi] }, pF = { part: P.foot[gi] };
    m.capsule(W(...g.hip), W(...g.knee), 0.09, 0.07, suit, { weight: lw, ...pT });
    m.capsule(W(...g.knee), W(...g.ankle), 0.067, 0.059, suit, { weight: lw, ...pS });
    const sc = W(g.ankle[0] + 0.065, 0.048, g.ankle[2]);
    m.ellipsoid(sc[0], sc[1], sc[2], 0.14, 0.05, 0.052, M.SHOE, { ...turn, weight: lw, ...pF, keep: (x, y) => y > 0.004 });
    // Crease down the front of the trouser, and the break where it meets the shoe.
    m.line([W(g.hip[0] + 0.088, g.hip[1] - 0.13, g.hip[2]), W(g.knee[0] + 0.07, g.knee[1], g.knee[2])], M.DETAIL_SOFT, { weight: lw, ...pT });
    m.line([W(g.knee[0] + 0.07, g.knee[1], g.knee[2]), W(g.ankle[0] + 0.061, g.ankle[1] + 0.05, g.ankle[2])], M.DETAIL_SOFT, { weight: lw, ...pS });
    if (P.root) {
      const brk = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        brk.push(W(g.ankle[0] + Math.cos(a) * 0.066, g.ankle[1] + 0.03 + Math.cos(a) * 0.012, g.ankle[2] + Math.sin(a) * 0.062));
      }
      m.line(brk, M.DETAIL_SOFT, { weight: 0.5 * lw, ...pS });
    }
    // The welt where the shoe meets the sole.
    const welt = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      welt.push(W(g.ankle[0] + 0.065 + Math.cos(a) * 0.142, 0.012, g.ankle[2] + Math.sin(a) * 0.054));
    }
    m.line(welt, M.DETAIL, { weight: 0.8 * lw, ...pF });
  });

  // Collar, neck, head.
  const hx = 0.012 + lean * 1.4, hy = 1.705 + drop;
  const col = W(0.012 + lean, 1.505 + drop, 0);
  const TR = { ...turn, ...R0 };
  m.ellipsoid(col[0], col[1], col[2], 0.064, 0.03, 0.062, M.SHIRT, TR);
  m.capsule(W(0.012 + lean, 1.49 + drop, 0), W(hx + 0.01, hy - 0.1, 0), 0.047, 0.045, M.SKIN, R0);
  let p = W(hx, hy, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.083, 0.106, 0.07, M.SKIN, TR);
  p = W(hx + 0.034, hy - 0.07, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.064, 0.05, 0.06, M.SKIN, TR);
  p = W(hx + 0.097, hy - 0.015, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.022, 0.028, 0.0135, M.SKIN, TR);
  for (const s of [-1, 1]) {
    p = W(hx - 0.016, hy - 0.01, s * 0.074);
    m.ellipsoid(p[0], p[1], p[2], 0.02, 0.033, 0.012, M.SKIN, TR);
  }
  p = W(hx - 0.02, hy + 0.03, 0);
  m.ellipsoid(p[0], p[1], p[2], 0.09, 0.092, 0.075, M.HAIR, {
    ...TR,
    keep: (x, y, z) => {
      const [lx, ly] = L(x, y, z);
      return ly > hy - 0.05 + Math.max(0, lx - hx + 0.03) * 1.25;
    },
  });

  // Arms.
  o.arms.forEach((a, ai) => {
    const pU = { part: P.ua[ai] }, pA = { part: P.fa[ai] };
    const wr2 = [a.el[0] + (a.wr[0] - a.el[0]) * 0.88, a.el[1] + (a.wr[1] - a.el[1]) * 0.88, a.el[2] + (a.wr[2] - a.el[2]) * 0.88];
    m.capsule(W(...a.sh), W(...a.el), 0.068, 0.058, suit, pU);
    m.capsule(W(...a.el), W(...wr2), 0.057, 0.049, suit, pA);
    m.capsule(W(...wr2), W(...a.wr), 0.045, 0.044, M.SHIRT, pA);
    const hc = W(a.wr[0] + a.hand[0], a.wr[1] + a.hand[1], a.wr[2] + a.hand[2]);
    m.ellipsoid(hc[0], hc[1], hc[2], a.handR[0], a.handR[1], a.handR[2], M.SKIN, { ...turn, ...pA });
    if (a.thumb) {
      m.capsule(W(a.wr[0] + 0.035, a.wr[1] + 0.02, a.wr[2] + 0.01), W(a.wr[0] + 0.085, a.wr[1] + 0.027, a.wr[2] - 0.005), 0.016, 0.014, M.SKIN, pA);
    }
    // The jacket cuff's edge above the shirt cuff.
    if (P.root) {
      const cuf = [];
      const dx = a.wr[0] - a.el[0], dy = a.wr[1] - a.el[1], dz = a.wr[2] - a.el[2];
      const dl = Math.hypot(dx, dy, dz) || 1;
      const ux = dx / dl, uy = dy / dl, uz = dz / dl;
      // two vectors across the forearm
      let qx = -uy, qy = ux, qz = 0;
      const ql = Math.hypot(qx, qy, qz) || 1; qx /= ql; qy /= ql;
      const rx = uy * qz - uz * qy, ry = uz * qx - ux * qz, rz = ux * qy - uy * qx;
      for (let i = 0; i <= 14; i++) {
        const t = (i / 14) * Math.PI * 2, c = Math.cos(t) * 0.051, sn = Math.sin(t) * 0.051;
        cuf.push(W(wr2[0] + qx * c + rx * sn, wr2[1] + qy * c + ry * sn, wr2[2] + qz * c + rz * sn));
      }
      m.line(cuf, M.DETAIL, { weight: 0.6, ...pA });
    }
  });

  // Tailoring, drawn: lapels, the front's cutaway, pockets, the hem.
  for (const s of [-1, 1]) {
    const vee = [], lapel = [], cut = [], hem = [];
    for (let y = yCollar; y >= yButton; y -= 0.012) {
      const z = s * vHalf(y);
      vee.push(W(frontX(y, z), y, z));
      const zo = s * (vHalf(y) + 0.072 * clamp01((y - yButton) / 0.3));
      lapel.push(W(frontX(y, zo), y, zo));
    }
    for (let y = yButton2; y >= yHem; y -= 0.01) {
      const z = s * 0.075 * Math.pow((yButton2 - y) / (yButton2 - yHem), 1.4);
      cut.push(W(frontX(y, z), y, z));
    }
    for (let z = 0.075; z <= 0.19; z += 0.01) hem.push(W(frontX(yHem + 0.004, s * z) - 0.004, yHem + 0.004, s * z));
    m.line(vee, M.DETAIL, R0);
    m.line(lapel, M.DETAIL_SOFT, R0);
    m.line(cut, M.DETAIL, R0);
    m.line(hem, M.DETAIL_SOFT, R0);
    const py = 0.925 + drop;
    m.line([W(frontX(py, s * 0.07), py, s * 0.07), W(frontX(py, s * 0.165), py, s * 0.165)], M.DETAIL_SOFT, R0);
  }
  const by = 1.285 + drop;
  m.line([W(frontX(by, -0.075), by, -0.075), W(frontX(by, -0.15), by, -0.15)], M.DETAIL_SOFT, R0);

  // The rig: joint pivots (world), the lateral axis the limbs swing about, and the body's centre.
  const pivot = (q) => W(q[0], q[1], q[2]);
  return {
    parts: P,
    yaw: th,
    centre: [X, Y, Z],
    lateral: [st, 0, ct],
    hip: legs.map((g) => pivot(g.hip)),
    knee: legs.map((g) => pivot(g.knee)),
    ankle: legs.map((g) => pivot(g.ankle)),
    sh: o.arms.map((a) => pivot(a.sh)),
    el: o.arms.map((a) => pivot(a.el)),
  };
}

const FREE_ARM = { sh: [-0.005, 1.425, -0.198], el: [-0.035, 1.125, -0.215], wr: [-0.005, 0.875, -0.205], hand: [0.005, -0.07, 0.005], handR: [0.034, 0.072, 0.03] };
const SHAKE_ARM = { sh: [-0.005, 1.425, 0.198], el: [0.075, 1.14, 0.165], wr: [0.325, 1.035, 0.055], hand: [0.06, -0.012, -0.02], handR: [0.068, 0.047, 0.036], thumb: true, shake: true };

/* ── Ground and the lot ────────────────────────────────────────────────── */

/** A ground disc: paper in the light, a soft tone where the figures' shadow falls. */
function ground(m, cx, cz, rx, rz, weight, shadowR, light) {
  m.custom(Math.PI * rx * rz * 0.18 * weight, (rand, out) => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    if (rand() > 1 - 0.8 * r * r) return false;
    const x = cx + Math.cos(a) * r * rx, z = cz + Math.sin(a) * r * rz;
    out[0] = x; out[1] = 0; out[2] = z;
    out[3] = 0; out[4] = 1; out[5] = 0;
    out[6] = SURF; out[7] = M.GROUND; out[8] = 0; out[9] = 1; out[10] = 0;
    const near = Math.hypot(x - cx, z - cz) < shadowR;
    out[11] = near ? 0.05 + 0.95 * m.shadow(x, 0.005, z, light, 2.4, 12) : 1;
    return true;
  });
}

/* ── FIG. 01 Partnership ───────────────────────────────────────────────── */

/**
 * After the album cover, drawn new: a wide shot of an open lot, low studio
 * buildings on the horizon, two men in dark suits walking in from either
 * side. Scroll walks them: they meet at the centre, turn a little to the
 * camera, shake — a firm pump — and hold. Each man is modelled in the
 * handshake itself, so the end of the walk is the clasp exactly; every
 * earlier moment is a pose of jointed parts (hips, knees, ankles,
 * shoulders, elbows) about the body's own lateral axis.
 */

const TURN_IN = 34 * D2R;
/** The owner's frames of the walk (2026-10-06): the last steps, the turn and the pump. */
const WALK_FROM = 0.487;
const WALK_TO = 0.751;
const MEET = 0.62; // share of the chapter's hold spent walking
const STRIDE = 1.26; // metres per walk cycle (two steps)
const HIP_AMP = 0.38;
const STAND = 0.93; // stage offset: the figures' mid-height (ground at −0.95 after staging)

function rigParts(base) {
  return {
    root: base,
    thigh: [base + 1, base + 2],
    shin: [base + 3, base + 4],
    foot: [base + 5, base + 6],
    ua: [base + 7, base + 8],
    fa: [base + 9, base + 10],
  };
}

/** Straight standing legs (the rig bends them). */
function rigLegs() {
  return [
    { hip: [0, 0.93, 0.095], knee: [0.018, 0.5, 0.1], ankle: [0.005, 0.085, 0.1] },
    { hip: [0, 0.93, -0.095], knee: [0.018, 0.5, -0.1], ankle: [0.005, 0.085, -0.1] },
  ];
}

/** The lot: a ground of fine stipple fading to the horizon, a few markings, low studio buildings far behind. */
function lot(m) {
  // Asphalt stipple, sparser with distance.
  m.custom(9.0, (rand, out) => {
    const x = (rand() * 2 - 1) * 5.2;
    const z = 1.9 - Math.pow(rand(), 0.7) * 17;
    const far = (1.9 - z) / 17;
    if (rand() < far * 0.6) return false;
    out[0] = x; out[1] = 0; out[2] = z;
    out[3] = 1; out[4] = 0; out[5] = 0;
    out[6] = LINE; out[7] = M.GRAT; out[8] = 0; out[9] = 1; out[10] = 0; out[11] = 1;
    return true;
  }, { weight: 0.16 });
  // Painted markings, running away from the camera.
  const mk = { weight: 0.22 };
  for (const x of [-2.6, 2.4]) m.line([[x, 0.001, 1.6], [x * 1.04, 0.001, -9.5]], M.FAR, mk);
  m.line([[-5.2, 0.001, -2.4], [5.2, 0.001, -2.4]], M.FAR, { weight: 0.14 });
  // The horizon: studio buildings, low, far and pale — a roofline, a few doors, a stair.
  const far = { weight: 0.12 };
  const B = [[-8.4, -4.6, 1.6, -16], [-4.1, -1.6, 1.2, -17], [1.4, 4.8, 1.4, -16.5], [5.2, 8.6, 1.9, -15.5]];
  for (const [x0, x1, h, z] of B) {
    m.line([[x0, 0, z], [x0, h, z], [x1, h, z], [x1, 0, z]], M.FAR, far);
    const cx = (x0 + x1) / 2;
    m.line([[cx - 0.4, 0, z + 0.01], [cx - 0.4, 1.0, z + 0.01], [cx + 0.4, 1.0, z + 0.01], [cx + 0.4, 0, z + 0.01]], M.FAR, { weight: 0.05 });
  }
  m.line([[5.6, 0, -15.48], [6.9, 1.4, -15.48], [7.6, 1.4, -15.48]], M.FAR, { weight: 0.05 });
  m.line([[-10, 0, -17.5], [10, 0, -17.5]], M.FAR, { weight: 0.1 });
}

/** A soft shadow under a man, carried with him (his root part). */
function shadowUnder(m, cx, cz, part) {
  m.custom(0.55, (rand, out) => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    const x = cx + 0.12 + Math.cos(a) * r * 0.42, z = cz - 0.1 + Math.sin(a) * r * 0.24;
    out[0] = x; out[1] = 0.002; out[2] = z;
    out[3] = 0; out[4] = 1; out[5] = 0;
    out[6] = SURF; out[7] = M.GROUND; out[8] = part; out[9] = 1; out[10] = 0;
    out[11] = 0.18 + 0.7 * r * r;
    return true;
  }, { weight: 0.5 });
}

function* stepsPartnership(n) {
  const m = new Model(11, 0.002);
  m.aoScale = 0.06;
  const hand = (yaw) => {
    const hx = SHAKE_ARM.wr[0] + SHAKE_ARM.hand[0], hz = SHAKE_ARM.wr[2] + SHAKE_ARM.hand[2];
    return [hx * Math.cos(yaw) + hz * Math.sin(yaw), -hx * Math.sin(yaw) + hz * Math.cos(yaw)];
  };
  const yA = -TURN_IN, yB = Math.PI + TURN_IN;
  const hA = hand(yA), hB = hand(yB);
  // Placed so the two hands meet at the clasp, at the origin.
  const xA = -hA[0] - 0.012, xB = -hB[0] + 0.012, zA = -hA[1], zB = -hB[1];
  const rigA = man(m, { x: xA, z: zA, yaw: yA, suit: M.SUIT_A, tie: M.TIE_A, legs: rigLegs(), arms: [SHAKE_ARM, FREE_ARM], parts: rigParts(1) });
  const rigB = man(m, { x: xB, z: zB, yaw: yB, suit: M.SUIT_B, tie: M.TIE_B, legs: rigLegs(), arms: [SHAKE_ARM, FREE_ARM], parts: rigParts(12) });
  shadowUnder(m, xA, zA, 1);
  shadowUnder(m, xB, zB, 12);
  lot(m);
  const c = yield* m.steps(n, 0.037);
  // Rig in stage space (staging shifts y by −STAND·…).
  const st = (q) => [q[0], q[1] - STAND, q[2]];
  for (const R of [rigA, rigB]) {
    for (const k of ["hip", "knee", "ankle", "sh", "el"]) R[k] = R[k].map(st);
    R.centre = st(R.centre);
  }
  rigA.walkYaw = 0;
  rigA.dir = 1;
  rigA.phase0 = 0.25;
  rigB.walkYaw = Math.PI;
  rigB.dir = -1;
  rigB.phase0 = 0.72;
  c.rig = [rigA, rigB];
  return toStage(c, 0, STAND, 0, 1);
}

/* ── The rig in motion ─────────────────────────────────────────────────── */

const RA = new Float64Array(12), RB = new Float64Array(12), RT = new Float64Array(12);
const ROOT = new Float64Array(12), THIGH = new Float64Array(12), SHIN = new Float64Array(12), UA = new Float64Array(12);

/** 3×4 rotation about the unit axis (ax, ay, az) through (px, py, pz). */
function mRot(o, ax, ay, az, a, px, py, pz) {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  o[0] = t * ax * ax + c; o[1] = t * ax * ay - s * az; o[2] = t * ax * az + s * ay;
  o[4] = t * ax * ay + s * az; o[5] = t * ay * ay + c; o[6] = t * ay * az - s * ax;
  o[8] = t * ax * az - s * ay; o[9] = t * ay * az + s * ax; o[10] = t * az * az + c;
  o[3] = px - (o[0] * px + o[1] * py + o[2] * pz);
  o[7] = py - (o[4] * px + o[5] * py + o[6] * pz);
  o[11] = pz - (o[8] * px + o[9] * py + o[10] * pz);
}
/** o = A · B (affine 3×4). o may not alias A or B. */
function mMul(o, A, B) {
  for (let r = 0; r < 3; r++) {
    const a0 = A[r * 4], a1 = A[r * 4 + 1], a2 = A[r * 4 + 2], a3 = A[r * 4 + 3];
    o[r * 4] = a0 * B[0] + a1 * B[4] + a2 * B[8];
    o[r * 4 + 1] = a0 * B[1] + a1 * B[5] + a2 * B[9];
    o[r * 4 + 2] = a0 * B[2] + a1 * B[6] + a2 * B[10];
    o[r * 4 + 3] = a0 * B[3] + a1 * B[7] + a2 * B[11] + a3;
  }
}
function mPut(Mx, p, A) {
  const b = p * 12;
  for (let i = 0; i < 12; i++) Mx[b + i] = A[i];
}
/** Child = parent · rotation about the lateral axis through q. */
function limb(out, parent, lat, a, q) {
  mRot(RT, lat[0], lat[1], lat[2], a, q[0], q[1], q[2]);
  mMul(out, parent, RT);
}
const ease = (x) => x * x * (3 - 2 * x);
const sstep = (a, b, x) => ease(clamp01((x - a) / (b - a)));

/** Poses one man at walk progress u (0 … 1 of the chapter's hold). */
function poseMan(Mx, R, u, t, D) {
  const s = clamp01(u / MEET);
  const travel = s * (2 - s); // eases to a stop
  const rem = D * (1 - travel);
  const phi = R.phase0 + (D * travel) / STRIDE;
  const amp = 1 - sstep(0.7, 1, s);
  const w = 2 * Math.PI * phi;
  const lat = R.lateral;
  // Root: the turn from walking (profile) to the handshake (three-quarter), the approach, the bob.
  const dYaw = (R.walkYaw - R.yaw) * (1 - sstep(0.55, 1, s));
  const bob = 0.016 * amp * (Math.cos(2 * w) - 1) * 0.5;
  mRot(RA, 0, 1, 0, dYaw, R.centre[0], 0, R.centre[2]);
  RA[3] += -R.dir * rem;
  RA[7] += bob;
  mPut(Mx, R.parts.root, RA);
  ROOT.set(RA);
  // Legs: right (0) and left (1), half a cycle apart.
  for (let g = 0; g < 2; g++) {
    const ph = w + (g ? Math.PI : 0);
    const hip = HIP_AMP * amp * Math.sin(ph);
    const knee = amp * (0.07 + 0.92 * Math.pow(Math.max(0, Math.cos(ph - 0.35)), 1.6));
    const ankle = -(hip - knee) * 0.82 - 0.18 * amp * Math.max(0, -Math.sin(ph));
    limb(THIGH, ROOT, lat, hip, R.hip[g]);
    mPut(Mx, R.parts.thigh[g], THIGH);
    limb(SHIN, THIGH, lat, -knee, R.knee[g]);
    mPut(Mx, R.parts.shin[g], SHIN);
    limb(RB, SHIN, lat, ankle, R.ankle[g]);
    mPut(Mx, R.parts.foot[g], RB);
  }
  // Arms: the shaking arm (0) hangs and swings while walking, then rises to the clasp.
  const k = sstep(0.42, 0.9, s);
  const swing0 = -0.32 * amp * Math.sin(w);
  const swing1 = -0.32 * amp * Math.sin(w + Math.PI);
  const sh0 = (swing0 - 0.27) * (1 - k);
  const el0 = (-0.63 + 0.12 * Math.max(0, swing0)) * (1 - k);
  // The pump: two firm strokes once the hands meet, then the hold breathes.
  const pu = clamp01((u - MEET - 0.04) / 0.26);
  const pump = 0.11 * Math.sin(pu * Math.PI * 4) * (1 - pu * 0.4) * (pu > 0 && pu < 1 ? 1 : 0) + 0.025 * Math.sin(t * 2 * Math.PI * 0.42) * sstep(0.95, 1, u);
  limb(UA, ROOT, lat, sh0, R.sh[0]);
  mPut(Mx, R.parts.ua[0], UA);
  limb(RB, UA, lat, el0 + pump * R.pumpSign, R.el[0]);
  mPut(Mx, R.parts.fa[0], RB);
  limb(UA, ROOT, lat, swing1, R.sh[1]);
  mPut(Mx, R.parts.ua[1], UA);
  limb(RB, UA, lat, 0.08 + 0.1 * amp * Math.max(0, swing1), R.el[1]);
  mPut(Mx, R.parts.fa[1], RB);
}

/* ── FIG. 02 The decade ────────────────────────────────────────────────── */

let LAND = null;
function landAt(lat, lon) {
  if (!LAND) {
    const bin = atob(LAND_BITS);
    LAND = new Uint8Array(LAND_W * LAND_H);
    for (let i = 0; i < LAND.length; i++) LAND[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  }
  const fx = (((lon + 180) / 360) * LAND_W) % LAND_W;
  const fy = ((90 - lat) / 180) * LAND_H;
  // Bilinear, so coastlines are smooth at the cell size.
  const x0 = Math.floor(fx - 0.5), y0 = Math.floor(fy - 0.5);
  const tx = fx - 0.5 - x0, ty = fy - 0.5 - y0;
  const at = (x, y) => LAND[Math.min(LAND_H - 1, Math.max(0, y)) * LAND_W + ((x + LAND_W) % LAND_W)];
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

let INDIA_MASK = null;
/** Whether (lat, lon) lies in India (its official boundary). */
function inIndia(lat, lon) {
  if (!INDIA_MASK) {
    const bin = atob(INDIA.bits);
    INDIA_MASK = new Uint8Array(INDIA.w * INDIA.h);
    for (let i = 0; i < INDIA_MASK.length; i++) INDIA_MASK[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  }
  const x = Math.floor((lon - INDIA.lon0) / INDIA.step), y = Math.floor((INDIA.lat1 - lat) / INDIA.step);
  if (x < 0 || y < 0 || x >= INDIA.w || y >= INDIA.h) return false;
  return INDIA_MASK[y * INDIA.w + x] === 1;
}

let RELIEF = null;
/** NASA relief luminance at (lat, lon), 0 (dark) … 1 (bright), bilinear. */
function reliefAt(lat, lon) {
  if (!RELIEF) {
    const bin = atob(RELIEF_BITS);
    RELIEF = new Uint8Array(RELIEF_W * RELIEF_H);
    for (let i = 0; i < RELIEF.length; i++) RELIEF[i] = (bin.charCodeAt(i >> 1) >> ((i & 1) * 4)) & 15;
  }
  const fx = (((lon + 180) / 360) * RELIEF_W) % RELIEF_W;
  const fy = ((90 - lat) / 180) * RELIEF_H;
  const x0 = Math.floor(fx - 0.5), y0 = Math.floor(fy - 0.5);
  const tx = fx - 0.5 - x0, ty = fy - 0.5 - y0;
  const at = (x, y) => RELIEF[Math.min(RELIEF_H - 1, Math.max(0, y)) * RELIEF_W + ((x + RELIEF_W) % RELIEF_W)] / 15;
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

const LON0 = 78;
const LIGHT_EARTH = [0, 0, 0];
function ll(lat, lon, r = 1) {
  const a = lat * D2R, b = (lon - LON0) * D2R;
  return [r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b)];
}

const MUMBAI = [19.08, 72.88];
/** London, New York, Singapore, Dubai, Tokyo, Nairobi, Sydney. */
const CITIES = [[51.5, -0.13], [40.7, -74.0], [1.35, 103.8], [25.2, 55.3], [35.7, 139.7], [-1.29, 36.8], [-33.9, 151.2]];

function* stepsDecade(n) {
  const m = new Model(23, 0.002);
  // The sphere's face toward the camera (it never turns far): land a calm
  // tone, sea nearly paper, so the coastline carries the drawing.
  // Spread by the R2 low-discrepancy sequence (area-uniform over the cap), so
  // the face closes evenly at any point count — no holes for contours to find.
  let k = 0;
  m.custom(2 * Math.PI * 1.25, (rand, out) => {
    const u = (0.5 + k * 0.7548776662466927) % 1, v = (0.5 + k * 0.5698402909980532) % 1;
    k++;
    const z = -0.25 + u * 1.25;
    const t = v * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const x = r * Math.cos(t), y = r * Math.sin(t);
    const lat = Math.asin(y) / D2R;
    const lon = Math.atan2(x, z) / D2R + LON0;
    const lo = ((lon + 540) % 360) - 180;
    const land = landAt(lat, lo);
    out[0] = x; out[1] = y; out[2] = z;
    out[3] = x; out[4] = y; out[5] = z;
    out[6] = SURF; out[7] = land < 0.5 ? M.OCEAN : inIndia(lat, lo) ? M.INDIA : M.LAND; out[8] = 3; out[9] = 1; out[10] = 0;
    // The land's own tone: NASA relief — desert and ice light, forest dark.
    out[11] = land >= 0.5 ? 0.25 + 0.75 * Math.min(1, reliefAt(lat, lo) * 1.15) : 1;
    return true;
  });
  // Graticule, dotted and quiet.
  const g = { weight: 0.1, part: 4 };
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 3) pts.push(ll(lat, lon, 1.004));
    m.line(pts, M.GRAT, g);
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = [];
    for (let lat = -78; lat <= 78; lat += 3) pts.push(ll(lat, lon, 1.004));
    m.line(pts, M.GRAT, g);
  }
  // The limb: a fine ring just outside the sphere, facing the camera.
  const limb = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    limb.push([Math.cos(a) * 1.035, Math.sin(a) * 1.035, 0]);
  }
  m.line(limb, M.GRAT, { weight: 0.22, part: 3 });
  // Routes out of India: great circles lifted off the surface, pulsing outward.
  const a0 = ll(MUMBAI[0], MUMBAI[1]);
  for (const [lat, lon] of CITIES) {
    const b0 = ll(lat, lon);
    const dot = a0[0] * b0[0] + a0[1] * b0[1] + a0[2] * b0[2];
    const om = Math.acos(Math.max(-1, Math.min(1, dot)));
    const pts = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const s0 = Math.sin((1 - u) * om) / Math.sin(om), s1 = Math.sin(u * om) / Math.sin(om);
      const h = 1.006 + 0.08 * om * Math.sin(Math.PI * u);
      pts.push([(a0[0] * s0 + b0[0] * s1) * h, (a0[1] * s0 + b0[1] * s1) * h, (a0[2] * s0 + b0[2] * s1) * h]);
    }
    m.line(pts, M.ROUTE, { weight: 0.55, part: 4 });
  }
  // Two orbits, dashed, each turning about its own axis.
  const orbit = (R, tiltX, tiltZ, part) => {
    const cx = Math.cos(tiltX), sx = Math.sin(tiltX), cz = Math.cos(tiltZ), sz = Math.sin(tiltZ);
    const tf = (x, y, z) => {
      const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
      return [x * cz - y1 * sz, x * sz + y1 * cz, z1];
    };
    m.custom(2 * Math.PI * R * 0.037 * 0.4, (rand, out) => {
      const t = rand() * Math.PI * 2;
      if ((t * 30) % 1 > 0.5) return false;
      const p = tf(Math.cos(t) * R, 0, Math.sin(t) * R);
      const d = tf(-Math.sin(t), 0, Math.cos(t));
      out[0] = p[0]; out[1] = p[1]; out[2] = p[2];
      out[3] = d[0]; out[4] = d[1]; out[5] = d[2];
      out[6] = LINE; out[7] = M.RING; out[8] = part; out[9] = 1; out[10] = 0; out[11] = 1;
      return true;
    });
    return tf(0, 1, 0);
  };
  const ax1 = orbit(1.42, 0.32, 0.12, 1);
  const ax2 = orbit(1.7, -0.5, -0.3, 2);
  const c = yield* m.steps(n, 0.037);
  c.axes = [null, ax1, ax2];
  yield* buildEarth();
  const staged = toStage(c, 0, 0, 0, 1);
  spinFrame(staged);
  return staged;
}

/* The turning land. The sphere's points never move (they face the camera);
   their land, sea and tone are read each frame from an equirectangular table
   at the longitude now under them, so the globe turns eastward without ever
   showing its open back. */

const EARTH_W = 960, EARTH_H = 480, EARTH_STEP = 360 / EARTH_W;
let EARTH_MAT = null, EARTH_TONE = null;

function* buildEarth() {
  if (EARTH_MAT) return;
  const mat = new Uint8Array(EARTH_W * EARTH_H);
  const tone = new Float32Array(EARTH_W * EARTH_H);
  for (let y = 0; y < EARTH_H; y++) {
    const lat = 90 - (y + 0.5) * EARTH_STEP;
    for (let x = 0; x < EARTH_W; x++) {
      const lon = -180 + (x + 0.5) * EARTH_STEP;
      const land = landAt(lat, lon);
      const i = y * EARTH_W + x;
      mat[i] = land < 0.5 ? M.OCEAN : inIndia(lat, lon) ? M.INDIA : M.LAND;
      tone[i] = land >= 0.5 ? 0.25 + 0.75 * Math.min(1, reliefAt(lat, lon) * 1.15) : 1;
    }
    if ((y & 15) === 15) yield;
  }
  EARTH_MAT = mat;
  EARTH_TONE = tone;
}

/** Each surface point's row in the table and its longitude east of the facing meridian. */
function spinFrame(c) {
  const idx = [];
  for (let i = 0; i < c.n; i++) {
    const m = c.mat[i];
    if (c.part[i] === 3 && c.kind[i] === SURF && (m === M.OCEAN || m === M.LAND || m === M.INDIA)) idx.push(i);
  }
  const k = idx.length;
  c.spin = { idx: Uint32Array.from(idx), row: new Uint32Array(k), phi: new Float32Array(k), lon: LON0 };
  for (let j = 0; j < k; j++) {
    const i = idx[j];
    const x = c.pos[i * 3], y = c.pos[i * 3 + 1], z = c.pos[i * 3 + 2];
    const lat = Math.asin(Math.max(-1, Math.min(1, y))) / D2R;
    c.spin.row[j] = Math.min(EARTH_H - 1, Math.floor((90 - lat) / EARTH_STEP)) * EARTH_W;
    c.spin.phi[j] = Math.atan2(x, z) / D2R;
  }
}

/** Puts the land at longitude `lon` (degrees) under the sphere's facing point. */
function turnEarth(c, lon) {
  const S = c.spin;
  if (!S || !EARTH_MAT || Math.abs(S.lon - lon) < 0.05) return;
  S.lon = lon;
  const { idx, row, phi } = S;
  for (let j = 0; j < idx.length; j++) {
    let u = (phi[j] + lon + 180) / 360;
    u -= Math.floor(u);
    const e = row[j] + ((u * EARTH_W) | 0);
    const i = idx[j];
    c.mat[i] = EARTH_MAT[e];
    c.ao[i] = EARTH_TONE[e];
  }
}

/** The globe's own clock: runs only while the globe is drawn. */
const earthClock = { t: -1, idle: 0 };

/* ── FIG. 03 The work ──────────────────────────────────────────────────── */

const FLOORS = 16;
const FLOORS_AT_START = 5;

function lattice(m, a, b, w, steps, mat, o = {}) {
  // A square lattice column from a to b (vertical), width w: four chords, a ring and one diagonal per face per bay.
  const h = w / 2;
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (const [dx, dz] of corners) m.line([[a[0] + dx, a[1], a[2] + dz], [b[0] + dx, b[1], b[2] + dz]], mat, o);
  for (let i = 0; i < steps; i++) {
    const y0 = a[1] + ((b[1] - a[1]) * i) / steps, y1 = a[1] + ((b[1] - a[1]) * (i + 1)) / steps;
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4];
      m.line([[a[0] + x0, y0, a[2] + z0], [a[0] + x1, y0, a[2] + z1]], mat, { ...o, weight: (o.weight ?? 1) * 0.6 });
      const flip = (i + k) % 2 === 0;
      m.line([[a[0] + (flip ? x0 : x1), y0, a[2] + (flip ? z0 : z1)], [a[0] + (flip ? x1 : x0), y1, a[2] + (flip ? z1 : z0)]], mat, { ...o, weight: (o.weight ?? 1) * 0.7 });
    }
  }
}

/**
 * FIG. 03 The work — a tower crane beside a skyscraper going up. The tower
 * rises floor by floor with the scroll: finished, glazed floors below, the
 * open frame above, the concrete core leading; the crane holds the next
 * section on its hook. The city waits far behind, quiet.
 */
function* stepsWork(n) {
  const m = new Model(37, 0.002);
  const S = M.STEEL;
  const mx = -0.62, top = 2.18;
  // Mast: a clean lattice, sixteen bays.
  lattice(m, [mx, 0, 0], [mx, top, 0], 0.1, 16, S);
  // Slewing unit and cab.
  m.box(mx, top + 0.03, 0, 0.065, 0.03, 0.065, M.WEIGHT);
  m.box(mx + 0.1, top - 0.025, 0.055, 0.045, 0.038, 0.038, M.CHAIR);
  // Tower head.
  const apex = [mx, 2.6, 0];
  for (const [dx, dz] of [[-0.05, -0.05], [0.05, -0.05], [0.05, 0.05], [-0.05, 0.05]]) m.line([[mx + dx, top + 0.06, dz], apex], S);
  // Jib: a triangular truss — two bottom chords, a top chord, the web between.
  const j0 = mx + 0.055, j1 = 1.42, jy = top + 0.06, jt = jy + 0.085;
  m.line([[j0, jy, -0.038], [j1, jy, -0.038]], S);
  m.line([[j0, jy, 0.038], [j1, jy, 0.038]], S);
  m.line([[j0, jt, 0], [j1 - 0.14, jt, 0], [j1, jy, 0]], S);
  for (let x = j0; x < j1 - 0.14; x += 0.11) {
    const xn = Math.min(j1 - 0.14, x + 0.11);
    m.line([[x, jy, -0.038], [xn, jt, 0], [xn, jy, 0.038]], S, { weight: 0.7 });
  }
  // Counter-jib and its weights.
  const c0 = mx - 0.055, c1 = -1.18;
  m.line([[c0, jy, -0.038], [c1, jy, -0.038]], S);
  m.line([[c0, jy, 0.038], [c1, jy, 0.038]], S);
  for (let x = c0; x > c1 + 0.02; x -= 0.1) m.line([[x, jy, -0.038], [x - 0.1, jy, 0.038]], S, { weight: 0.55 });
  for (let k = 0; k < 3; k++) m.box(-1.08 + k * 0.075, jy - 0.07, 0, 0.032, 0.06, 0.05, M.WEIGHT);
  // Pendants from the apex.
  m.line([apex, [0.62, jt, 0]], M.STEEL_SOFT);
  m.line([apex, [c1 + 0.03, jy, 0]], M.STEEL_SOFT);
  // Trolley (part 1); hook and the next section (part 2: travels with the trolley and swings).
  const tx = 0.66;
  m.box(tx, jy - 0.02, 0, 0.036, 0.014, 0.05, M.WEIGHT, { part: 1, ao: false });
  const hookY = 2.0;
  m.line([[tx - 0.012, jy - 0.035, 0], [tx - 0.012, hookY, 0]], M.STEEL_SOFT, { part: 3, weight: 0.6 });
  m.line([[tx + 0.012, jy - 0.035, 0], [tx + 0.012, hookY, 0]], M.STEEL_SOFT, { part: 3, weight: 0.6 });
  m.box(tx, hookY - 0.02, 0, 0.02, 0.022, 0.016, M.WEIGHT, { part: 2, ao: false });
  m.line([[tx, hookY - 0.042, 0], [tx - 0.16, hookY - 0.13, 0]], M.STEEL_SOFT, { part: 2, weight: 0.55 });
  m.line([[tx, hookY - 0.042, 0], [tx + 0.16, hookY - 0.13, 0]], M.STEEL_SOFT, { part: 2, weight: 0.55 });
  // The next section: a column pair and its beam.
  m.box(tx, hookY - 0.14, 0, 0.2, 0.012, 0.02, M.WEIGHT, { part: 2, ao: false });
  m.line([[tx - 0.17, hookY - 0.15, 0], [tx - 0.17, hookY - 0.29, 0]], S, { part: 2, weight: 0.7 });
  m.line([[tx + 0.17, hookY - 0.15, 0], [tx + 0.17, hookY - 0.29, 0]], S, { part: 2, weight: 0.7 });

  // The tower, floor by floor: a slender plan, glazed below, open frame above, the core leading.
  const bx0 = 0.02, bx1 = 0.66, bz = 0.27, fh = 0.112;
  const glazed = 6;
  for (let k = 0; k < FLOORS; k++) {
    const y0 = k * fh, y1 = (k + 1) * fh;
    // Floor edge on the two faces the camera sees.
    m.line([[bx0 - 0.015, y1, bz + 0.015], [bx1 + 0.015, y1, bz + 0.015], [bx1 + 0.015, y1, -bz - 0.015]], S, { weight: 1.0 });
    // Columns: corners and the middle of each face.
    for (const [x, z] of [[bx0, bz], [(bx0 + bx1) / 2, bz], [bx1, bz], [bx1, 0], [bx1, -bz]]) m.line([[x, y0, z], [x, y1, z]], S, { weight: 0.8 });
    if (k < glazed) {
      // Curtain wall: mullions on both faces.
      for (let i = 1; i < 8; i++) {
        if (i === 4) continue;
        const x = bx0 + ((bx1 - bx0) * i) / 8;
        m.line([[x, y0 + 0.01, bz + 0.004], [x, y1 - 0.006, bz + 0.004]], M.STEEL_SOFT, { weight: 0.5 });
      }
      for (let i = 1; i < 5; i++) {
        if (i === 2) continue;
        const z = -bz + ((2 * bz) * i) / 4;
        m.line([[bx1 + 0.004, y0 + 0.01, z], [bx1 + 0.004, y1 - 0.006, z]], M.STEEL_SOFT, { weight: 0.5 });
      }
    } else if (k % 2 === 0) {
      // Bracing on the open floors, alternating.
      m.line([[bx0, y0, bz], [(bx0 + bx1) / 2, y1, bz]], M.STEEL_SOFT, { weight: 0.5 });
    }
    // The core, a pale concrete shaft inside the frame.
    m.box((bx0 + bx1) / 2 - 0.05, (y0 + y1) / 2, -0.04, 0.09, fh / 2 - 0.004, 0.1, M.FAR, { ao: false, weight: 0.35 });
  }
  // Site ground: a hatch and the footprint.
  ground(m, 0.1, 0.1, 1.7, 1.0, 0.8, 0, keyLight(SCENE_YAW.work));
  m.line([[bx0 - 0.1, 0.002, bz + 0.1], [bx1 + 0.1, 0.002, bz + 0.1], [bx1 + 0.1, 0.002, -bz - 0.1], [bx0 - 0.1, 0.002, -bz - 0.1], [bx0 - 0.1, 0.002, bz + 0.1]], M.DETAIL_SOFT, { weight: 0.5 });
  // The city, far and light.
  const far = { weight: 0.1 };
  const blocks = [[-3.6, 0.7], [-3.0, 1.1], [-2.4, 0.55], [2.2, 0.8], [2.8, 0.6], [3.5, 1.2], [-4.2, 0.85]];
  for (const [x, h] of blocks) rect(m, [x, h / 2, -6], [0.3, 0, 0], [0, h / 2, 0], M.FAR, far);

  const c = yield* m.steps(n, 0.037);
  // The tower completes upwards in place: each of its points stands once the
  // rise reaches its own height (0 … 1 of the full tower). Nothing is carried
  // up from the ground.
  const H = FLOORS * fh;
  c.riseKey = new Float32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const x = c.pos[i * 3], y = c.pos[i * 3 + 1], z = c.pos[i * 3 + 2];
    const inside = x > bx0 - 0.03 && x < bx1 + 0.03 && Math.abs(z) < bz + 0.03 && y > 0.004 && y < H + 0.02;
    if (!inside || c.part[i] !== 0 || c.mat[i] === M.GROUND) continue;
    c.riseKey[i] = Math.min(1, y / H);
  }
  // The tower's base and full height in stage space (toStage below: (y − 1.3) · 0.78).
  c.riseY0 = (0 - 1.3) * 0.78;
  c.riseY1 = (H - 1.3) * 0.78;
  return toStage(c, 0.12, 1.3, 0, 0.78);
}

/* ── FIG. 04 A seat at the table ───────────────────────────────────────── */

function chair(m, c, yaw, mat) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const R = (x, y, z) => [c[0] + x * cs + z * sn, c[1] + y, c[2] - x * sn + z * cs];
  const fwd = [cs, 0, -sn], side = [sn, 0, cs];
  // Seat and back as panels; legs and frame as lines.
  panel(m, R(0, 0.46, 0), [fwd[0] * 0.22, 0, fwd[2] * 0.22], [side[0] * 0.22, 0, side[2] * 0.22], mat, { ao: 0.9 });
  panel(m, R(-0.23, 0.72, 0), [0, 0.22, 0], [side[0] * 0.21, 0, side[2] * 0.21], mat, { ao: 0.95 });
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) m.line([R(x, 0.45, z), R(x * 1.05, 0, z * 1.05)], M.DETAIL);
  m.line([R(-0.23, 0.46, -0.21), R(-0.23, 0.95, -0.21), R(-0.23, 0.95, 0.21), R(-0.23, 0.46, 0.21)], M.DETAIL, { weight: 0.8 });
  m.line([R(0.22, 0.47, -0.22), R(0.22, 0.47, 0.22)], M.DETAIL, { weight: 0.6 });
}

function* stepsTable(n) {
  const m = new Model(53, 0.002);
  m.aoScale = 0.05;
  // A long table across the frame.
  const tx = 0.92, tl = 0.62, tw = 0.44;
  m.box(tx, 0.735, 0, tl, 0.018, tw, M.WOOD);
  for (const [x, z] of [[tx - tl + 0.06, -tw + 0.06], [tx + tl - 0.06, -tw + 0.06], [tx + tl - 0.06, tw - 0.06], [tx - tl + 0.06, tw - 0.06]]) {
    m.line([[x, 0.72, z], [x, 0, z]], M.DETAIL);
  }
  // His place: papers, a pen, a glass.
  panel(m, [0.56, 0.7552, 0.06], [0.1, 0, 0.02], [-0.03, 0, 0.14], M.PAPER, { oneSided: true, ao: 1 });
  m.line([[0.66, 0.759, 0.16], [0.7, 0.759, 0.3]], M.DETAIL);
  m.capsule([0.62, 0.76, -0.28], [0.62, 0.86, -0.28], 0.03, 0.034, M.GLASS);
  // The other place, set and waiting.
  panel(m, [1.3, 0.7552, 0.06], [0.1, 0, -0.02], [0.03, 0, 0.14], M.PAPER, { oneSided: true, ao: 1 });
  m.line([[1.18, 0.759, 0.2], [1.22, 0.759, 0.33]], M.DETAIL);
  m.capsule([1.36, 0.76, -0.26], [1.36, 0.86, -0.26], 0.03, 0.034, M.GLASS);
  // The man, seated at the far end, forearms on the table, looking down its length.
  const seatedLegs = [
    { hip: [0, 0.52, 0.095], knee: [0.43, 0.53, 0.105], ankle: [0.45, 0.085, 0.11] },
    { hip: [0, 0.52, -0.095], knee: [0.42, 0.53, -0.105], ankle: [0.4, 0.085, -0.11] },
  ];
  const arms = [
    { sh: [0.035, 1.025, 0.198], el: [0.27, 0.79, 0.2], wr: [0.48, 0.79, 0.07], hand: [0.05, 0.005, -0.03], handR: [0.065, 0.032, 0.04] },
    { sh: [0.035, 1.025, -0.198], el: [0.27, 0.79, -0.2], wr: [0.48, 0.79, -0.05], hand: [0.05, 0.005, 0.03], handR: [0.065, 0.032, 0.04] },
  ];
  man(m, { x: 0, yaw: 0, suit: M.SUIT_B, tie: M.TIE_B, legs: seatedLegs, arms, seated: true });
  chair(m, [-0.04, 0, 0], 0, M.CHAIR);
  // The empty chair at the near end: pulled out, turned to whoever comes.
  chair(m, [1.86, 0, 0.42], -Math.PI / 2 - 0.5, M.CHAIR);
  ground(m, 0.95, 0.1, 1.7, 1.15, 1.1, 1.3, keyLight(SCENE_YAW.table));
  const c = yield* m.steps(n, 0.037);
  return toStage(c, 1.0, 0.6, 0.12, 1.4);
}

/* ── Scenes ────────────────────────────────────────────────────────────── */

const r = (deg) => deg * D2R;

export const SCENES = {
  partnership: {
    name: "partnership",
    figure: "FIG. 01 — PARTNERSHIP",
    build: (n) => drain(stepsPartnership(n)),
    steps: stepsPartnership,
    cam: { yaw: SCENE_YAW.partnership, pitch: r(4), dist: 4.4, w: 1.62, wn: 1.16, h: 1.86, ty: -0.03 },
    fog: [-0.8, 4.5],
    focus: [0, 0.07, 0],
    animated: true,
    /**
     * `v`: the chapter's progress. Its hold plays only the owner's frames — the
     * last steps, the turn into the handshake and the pump (old walk 0.487 …
     * 0.751, the plate's readout 13.40 … 20.65 before the change of pacing).
     */
    motion(t, v, Mx, cam, cloud) {
      const u = WALK_FROM + (WALK_TO - WALK_FROM) * clamp01(v / HOLD);
      const narrow = (cam.aspect || 1) < 0.9;
      const D = narrow ? 0.62 : 1.0;
      cam.yaw = r(YAW.partnership(v)) + r(0.8) * Math.sin(t * 0.21);
      cam.pitch += r(2.5) * clamp01(v / HOLD) + r(0.5) * Math.sin(t * 0.13 + 1);
      const rig = cloud && cloud.rig;
      if (!rig) return;
      for (const R of rig) {
        R.pumpSign = 1;
        poseMan(Mx, R, u, t, D);
      }
    },
  },
  decade: {
    name: "decade",
    figure: "FIG. 02 — THE DECADE",
    build: (n) => drain(stepsDecade(n)),
    steps: stepsDecade,
    cam: { yaw: SCENE_YAW.decade, pitch: r(14), dist: 5.2, w: 2.6, wn: 2.15, h: 2.5, ty: 0 },
    fog: [-1.1, 1.3],
    animated: true,
    /**
     * `v`: the chapter's progress. The land turns eastward (its near face moves
     * left to right) with the scroll, India passing the centre midway through
     * the hold, and drifts on slowly while the page rests. Sphere, limb, light
     * and orbits are set against the camera, so only the land visibly turns.
     */
    motion(t, v, Mx, cam, cloud) {
      const dt = earthClock.t < 0 ? 0 : Math.min(0.1, Math.max(0, t - earthClock.t));
      earthClock.t = t;
      earthClock.idle += dt;
      const yaw = r(YAW.decade(v));
      cam.yaw = yaw;
      const L = keyLight(yaw, LIGHT_EARTH);
      cam.lx = L[0];
      cam.ly = L[1];
      cam.lz = L[2];
      const lon = LON0 + 72 * (HOLD / 2 - v) - 1.2 * earthClock.idle;
      if (cloud) turnEarth(cloud, lon);
      rotate(Mx, 3, 0, 1, 0, yaw, 0, 0, 0);
      rotate(Mx, 4, 0, 1, 0, yaw + (LON0 - lon) * D2R, 0, 0, 0);
      const ax = cloud && cloud.axes;
      if (ax) {
        mRot(RB, 0, 1, 0, yaw, 0, 0, 0);
        mRot(RA, ax[1][0], ax[1][1], ax[1][2], t * 0.09 + v * 1.4, 0, 0, 0);
        mMul(RT, RB, RA);
        mPut(Mx, 1, RT);
        mRot(RA, ax[2][0], ax[2][1], ax[2][2], -(t * 0.06 + v * 1.0), 0, 0, 0);
        mMul(RT, RB, RA);
        mPut(Mx, 2, RT);
      }
    },
  },
  work: {
    name: "work",
    figure: "FIG. 03 — THE WORK",
    build: (n) => drain(stepsWork(n)),
    steps: stepsWork,
    cam: { yaw: SCENE_YAW.work, pitch: r(5), dist: 5.6, w: 2.6, wn: 2.05, h: 2.25, ty: 0.02 },
    fog: [-1.4, 2.6],
    animated: true,
    /** Height standing at the start of the chapter, and the full tower at its end. */
    rise(local) {
      return FLOORS_AT_START / FLOORS + clamp01(local) * (1 - FLOORS_AT_START / FLOORS);
    },
    /**
     * `v`: the chapter's progress; `rise`: the tower's height now (0 … 1). The
     * camera turns with the scroll; the hook carries the next section down to
     * the working floor and climbs with the tower.
     */
    motion(t, v, Mx, cam, cloud, rise) {
      const S = 0.78;
      cam.yaw = r(YAW.work(v)) + r(0.8) * Math.sin(t * 0.16);
      cam.pitch += r(3) * clamp01(v);
      const dx = (0.08 * Math.sin(t * 0.33)) * S;
      translate(Mx, 1, dx, 0, 0);
      const th = 0.05 * Math.sin(t * 1.7) + 0.02 * Math.sin(t * 0.33 + 0.4);
      const pivotX = (0.66 - 0.12) * S + dx, pivotY = (2.18 + 0.06 - 0.035 - 1.3) * S;
      // Hook height (model units): just above the working floor, never above its rest.
      const rz = rise == null ? 1 : rise;
      const hook = Math.min(2.0, rz * FLOORS * 0.112 + 0.3);
      const dy = (hook - 2.0) * S;
      // Hook and section: lowered by dy, then swung about the trolley.
      rotate(Mx, 2, 0, 0, 1, th, pivotX, pivotY, 0, dx, 0, 0);
      let b = 2 * 12;
      Mx[b + 3] += Mx[b + 1] * dy;
      Mx[b + 7] += Mx[b + 5] * dy;
      Mx[b + 11] += Mx[b + 9] * dy;
      // Cable: stretched from the trolley down to the hook, then swung with it.
      const yT = pivotY, yB0 = (2.0 - 1.3) * S;
      const sy = (yT - (yB0 + dy)) / (yT - yB0);
      rotate(Mx, 3, 0, 0, 1, th, pivotX, pivotY, 0, dx, 0, 0);
      b = 3 * 12;
      const k = yT * (1 - sy);
      Mx[b + 3] += Mx[b + 1] * k;
      Mx[b + 7] += Mx[b + 5] * k;
      Mx[b + 11] += Mx[b + 9] * k;
      Mx[b + 1] *= sy;
      Mx[b + 5] *= sy;
      Mx[b + 9] *= sy;
    },
  },
  table: {
    name: "table",
    figure: "FIG. 04 — A SEAT AT THE TABLE",
    build: (n) => drain(stepsTable(n)),
    steps: stepsTable,
    cam: { yaw: SCENE_YAW.table, pitch: r(16), dist: 4.8, w: 3.45, wn: 3.1, h: 2.2, ty: 0.08 },
    fog: [-1.0, 1.6],
    animated: true,
    motion(t, local, Mx, cam) {
      cam.yaw += r(4) * Math.sin(t * 0.15);
      cam.pitch += r(1) * Math.sin(t * 0.11);
    },
  },
};


/** The contact plate's closing scene, in its own module (golf-scene.js). */
if (GOLF) SCENES.golf = GOLF;

/** Older names still found in markup. */
export const ALIASES = { handshake: "partnership", globe: "decade", crane: "work", seat: "table" };

export function sceneByName(name) {
  return SCENES[name] || SCENES[ALIASES[name]] || null;
}

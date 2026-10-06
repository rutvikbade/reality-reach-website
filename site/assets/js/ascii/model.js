/**
 * Models: solids and lines, turned into a point cloud.
 *
 * A scene is modelled from a few primitive solids (ellipsoids, tapered
 * capsules, boxes) and drawn lines (polylines with a direction). The cloud
 * is a fixed number of points sampled evenly over the visible surfaces —
 * a point inside another solid is dropped, so the union reads as one form —
 * each carrying its normal (or, for a line, its direction), a material, an
 * ambient-occlusion term and the part it moves with.
 *
 * Every cloud in a theatre has the same number of points, so one figure's
 * matter can travel into the next.
 */

export const SURF = 0;
export const LINE = 1;

const ELL = 0;
const CAP = 1;
const BOX = 2;

/** Seeded PRNG (mulberry32): the same figure on every visit. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The point cloud. Typed arrays only; nothing is allocated per frame. */
/** Runs a build generator to its end and returns its value. */
export function drain(it) {
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

export class Cloud {
  constructor(n) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.nrm = new Float32Array(n * 3);
    this.kind = new Uint8Array(n);
    this.mat = new Uint8Array(n);
    this.ao = new Float32Array(n).fill(1);
    this.part = new Uint8Array(n);
    this.w = new Float32Array(n);
    this.phase = new Float32Array(n);
    /** Pairing order for change-overs (identity once the cloud is stored in rank order). */
    this.order = new Uint32Array(n);
  }
}

export class Model {
  constructor(seed = 1, eps = 0.002) {
    this.solids = [];
    this.lines = [];
    this.customs = [];
    this.rand = rng(seed);
    this.eps = eps;
  }

  /** Ellipsoid, turned by `o.yaw` about the vertical. */
  ellipsoid(cx, cy, cz, rx, ry, rz, mat, o = {}) {
    const yaw = o.yaw || 0;
    return this._solid(ELL, [cx, cy, cz, rx, ry, rz, Math.cos(yaw), Math.sin(yaw)], mat, o, ellArea(rx, ry, rz));
  }

  /** Capsule from a to b, radius ra at a tapering to rb at b. */
  capsule(a, b, ra, rb, mat, o = {}) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const area = Math.PI * (ra + rb) * L + 2 * Math.PI * (ra * ra + rb * rb);
    return this._solid(CAP, [a[0], a[1], a[2], b[0], b[1], b[2], ra, rb], mat, o, area);
  }

  /** Axis-aligned box: centre and half-sizes. */
  box(cx, cy, cz, hx, hy, hz, mat, o = {}) {
    const area = 8 * (hx * hy + hy * hz + hx * hz);
    return this._solid(BOX, [cx, cy, cz, hx, hy, hz], mat, o, area);
  }

  _solid(type, p, mat, o, area) {
    const s = {
      type,
      p: Float64Array.from(p),
      mat,
      matFn: o.matFn || null,
      part: o.part || 0,
      wFn: o.wFn || null,
      weight: o.weight ?? 1,
      area,
      cull: o.cull !== false,
      keep: o.keep || null,
      ao: o.ao !== false,
      shadow: o.shadow !== false,
    };
    this.solids.push(s);
    return s;
  }

  /** A drawn line through points [[x,y,z], …]. */
  line(pts, mat, o = {}) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += dist3(pts[i - 1], pts[i]);
    if (L <= 0) return null;
    const l = { pts, len: L, mat, part: o.part || 0, wFn: o.wFn || null, weight: o.weight ?? 1, phase: o.phase || null };
    this.lines.push(l);
    return l;
  }

  /**
   * A custom sampler: `fn(rand, out)` writes one point into `out`
   * (x, y, z, nx, ny, nz, kind, mat, part, w, phase) and returns false to reject.
   */
  custom(measure, fn, o = {}) {
    this.customs.push({ measure, fn, weight: o.weight ?? 1, ao: o.ao === true });
  }

  /** Signed distance to the union of the culling solids (hard union). */
  sdf(x, y, z, skip = null) {
    let d = 1e9;
    const S = this.solids;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (s === skip || !s.cull) continue;
      const v = solidSdf(s, x, y, z);
      if (v < d) d = v;
    }
    return d;
  }

  /**
   * Samples `n` points. `lineK` is how many points a unit of line length gets
   * per point a unit of surface area gets (lines need to read continuous).
   */
  build(n, lineK = 0.05, light = [-0.5, 0.8, 0.45]) {
    return drain(this.steps(n, lineK, light));
  }

  /**
   * build(), as a generator: the same samples in the same order, pausing every
   * 256 so a page can spread the work across frames (identical output).
   */
  *steps(n, lineK = 0.05, light = [-0.5, 0.8, 0.45]) {
    let tick = 0;
    const rand = this.rand;
    const cloud = new Cloud(n);
    const S = this.solids;
    const Ls = this.lines;
    const C = this.customs;
    let total = 0;
    for (const s of S) total += s.area * s.weight;
    for (const l of Ls) total += l.len * lineK * l.weight;
    for (const c of C) total += c.measure * c.weight;
    // Oversample solids for culling losses, then thin to exactly n.
    const over = 1.35;
    const cand = [];
    const tmp = new Float64Array(12);
    // The last value is the occlusion to keep, or −1 to compute it from the field.
    const add = (x, y, z, nx, ny, nz, kind, mat, part, w, phase, ao) => {
      cand.push(x, y, z, nx, ny, nz, kind, mat, part, w, phase, ao);
    };
    for (const s of S) {
      const want = Math.round(((s.area * s.weight) / total) * n * over);
      let got = 0;
      for (let tries = 0; got < want && tries < want * 4; tries++) {
        if ((++tick & 255) === 0) yield;
        sampleSolid(s, rand, tmp);
        const x = tmp[0], y = tmp[1], z = tmp[2];
        if (s.keep && !s.keep(x, y, z)) continue;
        if (s.cull && this.sdf(x, y, z, s) < -this.eps) continue;
        const mat = s.matFn ? s.matFn(x, y, z, tmp[3], tmp[4], tmp[5]) : s.mat;
        if (mat < 0) continue;
        const w = s.wFn ? s.wFn(x, y, z) : 1;
        add(x, y, z, tmp[3], tmp[4], tmp[5], SURF, mat, s.part, w, 0, s.ao ? -1 : 1);
        got++;
      }
    }
    for (const l of Ls) {
      const want = Math.round(((l.len * lineK * l.weight) / total) * n);
      const segs = [];
      let acc = 0;
      for (let i = 1; i < l.pts.length; i++) {
        acc += dist3(l.pts[i - 1], l.pts[i]);
        segs.push(acc);
      }
      for (let k = 0; k < want; k++) {
        if ((++tick & 255) === 0) yield;
        const u = (k + rand()) / want;
        const t = u * l.len;
        let i = 0;
        while (i < segs.length - 1 && segs[i] < t) i++;
        const s0 = i === 0 ? 0 : segs[i - 1];
        const f = (t - s0) / Math.max(1e-9, segs[i] - s0);
        const a = l.pts[i], b = l.pts[i + 1];
        const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
        const dl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
        const w = l.wFn ? l.wFn(x, y, z) : 1;
        add(x, y, z, (b[0] - a[0]) / dl, (b[1] - a[1]) / dl, (b[2] - a[2]) / dl, LINE, l.mat, l.part, w, l.phase ? l.phase(u) : u, 1);
      }
    }
    for (const c of C) {
      const want = Math.round(((c.measure * c.weight) / total) * n * 1.1);
      let got = 0;
      for (let tries = 0; got < want && tries < want * 6; tries++) {
        if ((++tick & 255) === 0) yield;
        tmp.fill(0);
        if (c.fn(rand, tmp) === false) continue;
        add(tmp[0], tmp[1], tmp[2], tmp[3], tmp[4], tmp[5], tmp[6], tmp[7], tmp[8], tmp[9] || 0, tmp[10], c.ao ? -1 : tmp[11] || 1);
        got++;
      }
    }

    // Thin or pad to exactly n, keeping a random, even subset.
    const m = cand.length / 12;
    const idx = new Uint32Array(m);
    for (let i = 0; i < m; i++) idx[i] = i;
    for (let i = m - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = idx[i];
      idx[i] = idx[j];
      idx[j] = t;
    }
    for (let k = 0; k < n; k++) {
      if ((++tick & 255) === 0) yield;
      const src = idx[k % m] * 12;
      const j = k * 3;
      const jitter = k >= m ? 0.004 : 0;
      cloud.pos[j] = cand[src] + (rand() - 0.5) * jitter;
      cloud.pos[j + 1] = cand[src + 1] + (rand() - 0.5) * jitter;
      cloud.pos[j + 2] = cand[src + 2] + (rand() - 0.5) * jitter;
      cloud.nrm[j] = cand[src + 3];
      cloud.nrm[j + 1] = cand[src + 4];
      cloud.nrm[j + 2] = cand[src + 5];
      cloud.kind[k] = cand[src + 6];
      cloud.mat[k] = cand[src + 7];
      cloud.part[k] = cand[src + 8];
      cloud.w[k] = cand[src + 9];
      cloud.phase[k] = cand[src + 10];
      const aoV = cand[src + 11];
      cloud.ao[k] = aoV < 0 ? this.occlusion(cloud.pos[j], cloud.pos[j + 1], cloud.pos[j + 2], cloud.nrm[j], cloud.nrm[j + 1], cloud.nrm[j + 2]) : aoV;
    }
    this.light = light;
    return cloud;
  }

  /** Ambient occlusion from the union's distance field, three taps along the normal. */
  occlusion(x, y, z, nx, ny, nz) {
    const h = this.aoScale || 0.05;
    let occ = 0;
    let wt = 1;
    for (let i = 1; i <= 3; i++) {
      const t = h * i * i * 0.5;
      const d = this.sdf(x + nx * t, y + ny * t, z + nz * t);
      occ += Math.max(0, t - d) * wt;
      wt *= 0.55;
    }
    return Math.max(0, Math.min(1, 1 - (occ / h) * 1.6));
  }

  /**
   * Soft shadow from a key light at direction L, marched through the solids'
   * field (used for the ground under a figure; figures self-shade by light).
   */
  shadow(x, y, z, L, maxT = 3, k = 10) {
    let res = 1;
    let t = 0.02;
    for (let i = 0; i < 40 && t < maxT; i++) {
      const d = this.sdf(x + L[0] * t, y + L[1] * t, z + L[2] * t);
      if (d < 0.001) return 0;
      res = Math.min(res, (k * d) / t);
      t += Math.max(0.01, d);
    }
    return Math.max(0, Math.min(1, res));
  }
}

/* ── Primitive maths ────────────────────────────────────────────────────── */

function dist3(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function ellArea(a, b, c) {
  const p = 1.6075;
  return 4 * Math.PI * Math.pow((Math.pow(a * b, p) + Math.pow(a * c, p) + Math.pow(b * c, p)) / 3, 1 / p);
}

export function solidSdf(s, x, y, z) {
  const p = s.p;
  switch (s.type) {
    case ELL: {
      // Into the ellipsoid's own frame (undo its yaw).
      const dx = x - p[0], dz = z - p[2];
      const lx = dx * p[6] - dz * p[7], lz = dx * p[7] + dz * p[6];
      const px = lx / p[3], py = (y - p[1]) / p[4], pz = lz / p[5];
      const k0 = Math.sqrt(px * px + py * py + pz * pz);
      const qx = px / p[3], qy = py / p[4], qz = pz / p[5];
      const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(p[3], p[4], p[5]);
    }
    case CAP: {
      const ax = p[0], ay = p[1], az = p[2];
      const bx = p[3] - ax, by = p[4] - ay, bz = p[5] - az;
      const px = x - ax, py = y - ay, pz = z - az;
      const bb = bx * bx + by * by + bz * bz;
      let h = bb > 0 ? (px * bx + py * by + pz * bz) / bb : 0;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      const dx = px - bx * h, dy = py - by * h, dz = pz - bz * h;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p[6] + (p[7] - p[6]) * h);
    }
    default: {
      const qx = Math.abs(x - p[0]) - p[3], qy = Math.abs(y - p[1]) - p[4], qz = Math.abs(z - p[2]) - p[5];
      const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
      return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0);
    }
  }
}

/** One uniform surface sample of a solid into out[0..5] (position, normal). */
function sampleSolid(s, rand, out) {
  const p = s.p;
  switch (s.type) {
    case ELL: {
      const z = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      const ux = r * Math.cos(t), uy = z, uz = r * Math.sin(t);
      const c = p[6], s = p[7];
      const lx = ux * p[3], lz = uz * p[5];
      out[0] = p[0] + lx * c + lz * s;
      out[1] = p[1] + uy * p[4];
      out[2] = p[2] - lx * s + lz * c;
      const nx = ux / p[3], ny = uy / p[4], nz = uz / p[5];
      const l = Math.hypot(nx, ny, nz) || 1;
      out[3] = (nx * c + nz * s) / l;
      out[4] = ny / l;
      out[5] = (-nx * s + nz * c) / l;
      return;
    }
    case CAP: {
      const ax = p[0], ay = p[1], az = p[2];
      let bx = p[3] - ax, by = p[4] - ay, bz = p[5] - az;
      const L = Math.hypot(bx, by, bz) || 1e-9;
      bx /= L; by /= L; bz /= L;
      // An orthonormal frame around the axis.
      let ex, ey, ez;
      if (Math.abs(by) < 0.9) { ex = -bz; ey = 0; ez = bx; } else { ex = 0; ey = bz; ez = -by; }
      let el = Math.hypot(ex, ey, ez) || 1;
      ex /= el; ey /= el; ez /= el;
      const fx = by * ez - bz * ey, fy = bz * ex - bx * ez, fz = bx * ey - by * ex;
      const ra = p[6], rb = p[7];
      const side = Math.PI * (ra + rb) * L;
      const capA = 2 * Math.PI * ra * ra;
      const capB = 2 * Math.PI * rb * rb;
      const u = rand() * (side + capA + capB);
      const t = rand() * Math.PI * 2;
      const c = Math.cos(t), sn = Math.sin(t);
      if (u < side) {
        const h = rand();
        const r = ra + (rb - ra) * h;
        const nx = ex * c + fx * sn, ny = ey * c + fy * sn, nz = ez * c + fz * sn;
        out[0] = ax + bx * L * h + nx * r;
        out[1] = ay + by * L * h + ny * r;
        out[2] = az + bz * L * h + nz * r;
        out[3] = nx; out[4] = ny; out[5] = nz;
      } else {
        const atB = u >= side + capA;
        const r = atB ? rb : ra;
        const sign = atB ? 1 : -1;
        const zz = rand();
        const rr = Math.sqrt(1 - zz * zz);
        const nx = (ex * c + fx * sn) * rr + bx * zz * sign;
        const ny = (ey * c + fy * sn) * rr + by * zz * sign;
        const nz = (ez * c + fz * sn) * rr + bz * zz * sign;
        const ox = atB ? ax + bx * L : ax, oy = atB ? ay + by * L : ay, oz = atB ? az + bz * L : az;
        out[0] = ox + nx * r;
        out[1] = oy + ny * r;
        out[2] = oz + nz * r;
        out[3] = nx; out[4] = ny; out[5] = nz;
      }
      return;
    }
    default: {
      const hx = p[3], hy = p[4], hz = p[5];
      const ax = hy * hz, ay = hx * hz, az = hx * hy;
      let u = rand() * (ax + ay + az);
      const sgn = rand() < 0.5 ? -1 : 1;
      const r1 = rand() * 2 - 1, r2 = rand() * 2 - 1;
      out[3] = 0; out[4] = 0; out[5] = 0;
      if (u < ax) {
        out[0] = p[0] + hx * sgn; out[1] = p[1] + hy * r1; out[2] = p[2] + hz * r2; out[3] = sgn;
      } else if (u < ax + ay) {
        out[0] = p[0] + hx * r1; out[1] = p[1] + hy * sgn; out[2] = p[2] + hz * r2; out[4] = sgn;
      } else {
        out[0] = p[0] + hx * r1; out[1] = p[1] + hy * r2; out[2] = p[2] + hz * sgn; out[5] = sgn;
      }
    }
  }
}

/**
 * Pairing order for change-overs: points ranked by height band, then by
 * angle around the vertical axis, so matter keeps its place as it travels
 * (a head goes to a pole, feet to the ground) and the motion reads coherent.
 */
export function rankCloud(cloud, bands = 48) {
  const n = cloud.n;
  const P = cloud.pos;
  const ys = new Float32Array(n);
  for (let i = 0; i < n; i++) ys[i] = P[i * 3 + 1];
  const byY = Array.from({ length: n }, (_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const per = Math.ceil(n / bands);
  let k = 0;
  for (let b = 0; b < bands; b++) {
    const slice = byY.slice(b * per, Math.min(n, (b + 1) * per));
    slice.sort((a, c) => Math.atan2(P[a * 3 + 2], P[a * 3]) - Math.atan2(P[c * 3 + 2], P[c * 3]));
    for (const i of slice) cloud.order[k++] = i;
  }
  permute(cloud);
}

/**
 * Stores the cloud in its rank order, so a change-over walks both clouds
 * front to back (memory in order) and rank k is simply point k.
 */
function permute(c) {
  const n = c.n, o = c.order;
  const re3 = (a) => {
    const b = new Float32Array(a.length);
    for (let k = 0; k < n; k++) {
      const i = o[k] * 3;
      b[k * 3] = a[i];
      b[k * 3 + 1] = a[i + 1];
      b[k * 3 + 2] = a[i + 2];
    }
    return b;
  };
  const re1 = (a, T) => {
    const b = new T(n);
    for (let k = 0; k < n; k++) b[k] = a[o[k]];
    return b;
  };
  c.pos = re3(c.pos);
  c.nrm = re3(c.nrm);
  if (c.alt) c.alt = re3(c.alt);
  if (c.riseKey) c.riseKey = re1(c.riseKey, Float32Array);
  c.kind = re1(c.kind, Uint8Array);
  c.mat = re1(c.mat, Uint8Array);
  c.ao = re1(c.ao, Float32Array);
  c.part = re1(c.part, Uint8Array);
  c.w = re1(c.w, Float32Array);
  c.phase = re1(c.phase, Float32Array);
  for (let k = 0; k < n; k++) o[k] = k;
}

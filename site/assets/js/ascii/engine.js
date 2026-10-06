/**
 * The ASCII surface: a canvas of character cells.
 *
 * Glyphs are printed in DM Mono in the four inks the page declares
 * (`--ink-1` … `--ink-4`), one text run per row per ink. The vocabulary is
 * curated: tones are letters, digits and marks, measured for coverage so each step is
 * a real step; strokes for lines, contours and coasts.
 *
 * Every glyph prints in the darkest ink (`--ink-1`), clear and black (owner,
 * 2026-10-06). Depth still reads: the same darkness far away takes a lighter
 * glyph, so a figure stands forward and the world behind it recedes.
 */

/** Strokes: indices are fixed so the rasteriser can address them. */
const STROKES = "-/|\\_";
/**
 * Tones: letters, digits and marks, ordered by measured coverage when the
 * canvas is laid out. Thirteen steps, so a flat tone prints as a calm run of
 * one glyph (asciigen's look) and only a real change of tone changes it.
 */
const TONES = "·.:;=+ico2ZQ#";
export const ALL = " " + TONES + STROKES;
export const G_H = ALL.indexOf("-");
export const G_RISE = ALL.indexOf("/");
export const G_V = ALL.indexOf("|");
export const G_FALL = ALL.indexOf("\\");
export const G_LOW = ALL.indexOf("_");
export const G_DOT = ALL.indexOf("·");
const CODES = Uint16Array.from(ALL, (ch) => ch.charCodeAt(0));

/** How dark each ink reads on paper, ink-1 … ink-4 (normalised). */
const INK_K = [1, 0.78, 0.57, 0.38];
/** Depth fog: the share of darkness a figure keeps at fog level 0 … 3. */
const FOG_K = [1, 0.84, 0.66, 0.5];
export const DQ = 64;

const FONT_STACK = '"DM Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

export function fontString(px) {
  return `400 ${px}px ${FONT_STACK}`;
}

/** Waits for DM Mono (declared by the page) so coverage is measured from the real face. */
export async function prepareFont() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      document.fonts.load('400 12px "DM Mono"'),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    /* the fallback monospace still draws */
  }
}

/** Advance width and line height for a font size, in CSS px. */
export function cellMetrics(fontPx) {
  const c = document.createElement("canvas").getContext("2d");
  c.font = fontString(fontPx);
  const cw = c.measureText("MMMMMMMMMM").width / 10;
  return { cw, ch: Math.round(fontPx * 1.22 * 4) / 4 };
}

function readInk(el, name, fallback) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Type size for a plate: small enough that a figure has the cells it needs
 * (about 72 rows on a desktop plate, 60 on a phone), never under 7 px.
 */
export function pickFontPx(W, H) {
  const rowsWanted = H < 520 ? 58 : 84;
  let px = H / (rowsWanted * 1.22);
  px = Math.min(px, W / (70 * 0.6));
  // One point larger than the fitted size (owner, 2026-10-06): clearer glyphs.
  px = Math.max(8, Math.min(12, px + 1));
  return Math.round(px * 2) / 2;
}

export class AsciiRenderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.opts = opts;
    this.cols = 0;
    this.rows = 0;
    this.dirtyInk = true;
  }

  refreshInk() {
    this.dirtyInk = true;
  }

  /** Measures the canvas and reallocates. Returns true if anything changed. */
  layout() {
    const W = Math.max(1, this.canvas.clientWidth);
    const H = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fontPx = this.opts.fontPx || pickFontPx(W, H);
    if (W === this.W && H === this.H && dpr === this.dpr && fontPx === this.fontPx && !this.dirtyInk) return false;
    const sizeChanged = W !== this.W || H !== this.H || dpr !== this.dpr || fontPx !== this.fontPx;
    this.dirtyInk = false;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.fontPx = fontPx;
    const { cw, ch } = cellMetrics(fontPx);
    this.cw = cw;
    this.ch = ch;
    this.cols = Math.max(8, Math.floor(W / cw));
    this.rows = Math.max(4, Math.floor(H / ch));
    this.ox = (W - this.cols * cw) / 2;
    this.oy = (H - this.rows * ch) / 2;
    if (sizeChanged) {
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
      const n = this.cols * this.rows;
      this.glyph = new Uint8Array(n);
      this.ink = new Uint8Array(n);
      this.zbuf = new Float32Array(n);
      this.win = new Int32Array(n);
      this.dark = new Float32Array(n);
      this.dark2 = new Float32Array(n);
      this.cmat = new Uint8Array(n);
      this.flag = new Uint8Array(n);
    }
    this.measureGlyphs();
    return true;
  }

  /**
   * Reads the page's inks and measures each glyph's coverage (how much ink it
   * lays in its cell) from the real face, for the tone table.
   */
  measureGlyphs() {
    const dpr = this.dpr;
    this.inks = [
      readInk(this.canvas, "--ink-1", "#0a0a0a"),
      readInk(this.canvas, "--ink-2", "#404040"),
      readInk(this.canvas, "--ink-3", "#737373"),
      readInk(this.canvas, "--ink-4", "#a3a3a3"),
    ];
    const gw = Math.ceil(this.cw * dpr) + 1;
    const gh = Math.ceil(this.ch * dpr);
    const probe = document.createElement("canvas");
    probe.width = gw * ALL.length;
    probe.height = gh;
    const a = probe.getContext("2d", { willReadFrequently: true });
    a.font = fontString(this.fontPx * dpr);
    a.textBaseline = "middle";
    a.fillStyle = "#000";
    for (let g = 1; g < ALL.length; g++) a.fillText(ALL[g], g * gw, gh / 2);
    const data = a.getImageData(0, 0, probe.width, gh).data;
    const cov = new Float32Array(ALL.length);
    for (let g = 1; g < ALL.length; g++) {
      let sum = 0;
      for (let y = 0; y < gh; y++) {
        for (let x = g * gw; x < (g + 1) * gw; x++) sum += data[(y * probe.width + x) * 4 + 3];
      }
      cov[g] = sum / (255 * gw * gh);
    }
    this.buildLut(cov);
    this.codes = new Uint16Array(this.cols);
    this.rowInk = new Uint8Array(this.rows * 4);
    this.font = fontString(this.fontPx);
  }

  /**
   * The tone table: for each depth-fog level and each of DQ darkness steps,
   * the glyph and ink whose printed darkness is nearest, preferring the ink
   * that belongs to that depth.
   */
  buildLut(cov) {
    const tones = [];
    for (const ch of TONES) tones.push(ALL.indexOf(ch));
    let max = 0;
    for (const g of tones) max = Math.max(max, cov[g]);
    const lut = new Uint16Array(4 * DQ);
    const strokeInk = new Uint8Array(4 * DQ);
    for (let f = 0; f < 4; f++) {
      for (let q = 0; q < DQ; q++) {
        const D = q / (DQ - 1);
        const t = D * FOG_K[f];
        let best = 0, bestInk = Math.min(3, f), bestCost = t < 0.02 ? 0 : 1e9;
        // Black ink only: darkness is carried by the glyph's own coverage.
        bestInk = 0;
        if (t >= 0.02) {
          for (const g of tones) {
            const e = (cov[g] / max) * INK_K[0];
            const cost = Math.abs(e - t);
            if (cost < bestCost) { bestCost = cost; best = g; }
          }
        }
        lut[f * DQ + q] = (best << 2) | bestInk;
        // Strokes keep their glyph, in black.
        strokeInk[f * DQ + q] = 0;
      }
    }
    this.lut = lut;
    this.strokeInk = strokeInk;
  }

  clear() {
    this.glyph.fill(0);
  }

  /**
   * Prints the cells: one string per row per ink, spaces elsewhere, so a
   * frame is a few hundred text runs rather than thousands of stamps. The
   * face is monospaced, so every glyph lands on its cell.
   */
  draw() {
    const { ctx, cols, rows, glyph, ink, codes, rowInk } = this;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = this.font;
    ctx.textBaseline = "middle";
    rowInk.fill(0);
    for (let r = 0; r < rows; r++) {
      const base = r * cols;
      for (let c = 0; c < cols; c++) if (glyph[base + c] !== 0) rowInk[r * 4 + ink[base + c]] = 1;
    }
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = this.inks[k];
      for (let r = 0; r < rows; r++) {
        if (!rowInk[r * 4 + k]) continue;
        const base = r * cols;
        let last = -1;
        for (let c = 0; c < cols; c++) {
          const g = glyph[base + c];
          if (g !== 0 && ink[base + c] === k) {
            codes[c] = CODES[g];
            last = c;
          } else codes[c] = 32;
        }
        ctx.fillText(String.fromCharCode.apply(null, codes.subarray(0, last + 1)), this.ox, this.oy + (r + 0.5) * this.ch);
      }
    }
  }
}

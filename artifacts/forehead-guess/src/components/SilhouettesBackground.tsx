import { useEffect, useRef } from 'react';
import spriteUrl from '@assets/IMG_1724_1776974449305.png';

// ── Constants ──────────────────────────────────────────────────────────────────
const SKY = '#13141a';

// Neon palette (same as the rest of the game)
const COLORS = [
  '#ff4fa3', // pink
  '#39d5ff', // cyan
  '#ffd000', // yellow
  '#a855f7', // purple
  '#10b981', // emerald
  '#ef4444', // red
  '#f97316', // orange
  '#3b82f6', // blue
];

// The sprite sheet is 4 columns × 3 rows = 12 individual busts.
// Within each row the pairs already face each other:
//   col 0 (faces right) ↔ col 1 (faces left)
//   col 2 (faces right) ↔ col 3 (faces left)
// Natural pairs by flat index (row × 4 + col):
const PAIRS: [number, number][] = [
  [0, 1], [2, 3],   // row 0
  [4, 5], [6, 7],   // row 1
  [8, 9], [10, 11], // row 2
];
const SPRITE_COLS = 4;
const SPRITE_ROWS = 3;

// ── Types ──────────────────────────────────────────────────────────────────────
interface FloatingPair {
  pairIdx: number;   // which of the 6 canonical pairs
  x: number;         // centre-x (screen pixels)
  topY: number;      // y of the top of the busts (increases as it rises upward = decreasing value)
  speed: number;     // px / second upward
  bustW: number;     // rendered width of one bust
  bustH: number;     // rendered height of one bust
  colorL: string;
  colorR: string;
  glow: number;      // shadow blur radius (px)
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function pickColor(exclude?: string): string {
  let c = COLORS[Math.floor(Math.random() * COLORS.length)];
  while (c === exclude) c = COLORS[Math.floor(Math.random() * COLORS.length)];
  return c;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function SilhouettesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;

    // ── Pre-process sprite sheet ─────────────────────────────────────────────
    // We extract each of the 12 bust cells and convert the black background to
    // fully transparent. The result is a white-silhouette on alpha=0 background,
    // stored as an OffscreenCanvas-like HTMLCanvasElement.  We later tint with
    // destination-in + solid fill when drawing.
    let silhouettes: HTMLCanvasElement[] = [];
    let cellW = 0;
    let cellH = 0;
    let ready = false;

    function preprocessSprite(img: HTMLImageElement) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      cellW = iw / SPRITE_COLS;
      cellH = ih / SPRITE_ROWS;

      // Scratch canvas to read pixels
      const scratch = document.createElement('canvas');
      scratch.width = iw;
      scratch.height = ih;
      const sCtx = scratch.getContext('2d')!;
      sCtx.drawImage(img, 0, 0);

      silhouettes = [];

      for (let row = 0; row < SPRITE_ROWS; row++) {
        for (let col = 0; col < SPRITE_COLS; col++) {
          const sx = Math.round(col * cellW);
          const sy = Math.round(row * cellH);
          const sw = Math.round(cellW);
          const sh = Math.round(cellH);

          const raw = sCtx.getImageData(sx, sy, sw, sh);
          const d = raw.data;

          // For each pixel: if brightness > threshold → white + opaque.
          //                 otherwise               → transparent.
          for (let i = 0; i < d.length; i += 4) {
            const bright = d[i] + d[i + 1] + d[i + 2];
            if (bright > 50) {
              d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
            } else {
              d[i + 3] = 0;
            }
          }

          const oc = document.createElement('canvas');
          oc.width = sw;
          oc.height = sh;
          oc.getContext('2d')!.putImageData(raw, 0, 0);
          silhouettes.push(oc);
        }
      }

      ready = true;
    }

    // ── Reusable tint canvas ─────────────────────────────────────────────────
    const tint = document.createElement('canvas');
    const tCtx = tint.getContext('2d')!;

    function drawTinted(
      silhouette: HTMLCanvasElement,
      color: string,
      glow: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      alpha: number,
    ) {
      if (tint.width !== Math.ceil(dw) || tint.height !== Math.ceil(dh)) {
        tint.width  = Math.ceil(dw);
        tint.height = Math.ceil(dh);
      }
      tCtx.clearRect(0, 0, tint.width, tint.height);

      // Fill with target colour
      tCtx.fillStyle = color;
      tCtx.fillRect(0, 0, tint.width, tint.height);

      // Punch the silhouette shape through (keep only where silhouette is opaque)
      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(silhouette, 0, 0, tint.width, tint.height);
      tCtx.globalCompositeOperation = 'source-over';

      // Draw to main canvas with glow + alpha
      ctx.save();
      ctx.globalAlpha = alpha;
      if (glow > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur  = glow;
      }
      ctx.drawImage(tint, dx, dy, dw, dh);
      ctx.restore();
    }

    // ── Resize ───────────────────────────────────────────────────────────────
    let dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ── Spawn helper ─────────────────────────────────────────────────────────
    function spawnPair(screenW: number, screenH: number, startBelow = true): FloatingPair {
      const pairIdx = Math.floor(Math.random() * PAIRS.length);

      // Scale: 15–28% of screen width for one bust
      const frac  = 0.15 + Math.random() * 0.13;
      const bW    = Math.max(60, Math.min(screenW * frac, 160));
      const ratio = cellH / cellW;
      const bH    = bW * ratio;

      const pairW = bW * 2 + bW * 0.06; // two busts + small gap
      const margin = pairW / 2 + 10;
      const cx    = margin + Math.random() * (screenW - 2 * margin);

      const speed = 35 + Math.random() * 45; // px/s
      const topY  = startBelow ? screenH + bH + Math.random() * screenH : screenH * (Math.random() * 1.5);

      const colorL = pickColor();
      const colorR = pickColor(colorL);

      return {
        pairIdx,
        x: cx,
        topY,
        speed,
        bustW: bW,
        bustH: bH,
        colorL,
        colorR,
        glow: 18 + Math.random() * 20,
      };
    }

    // ── Animation loop ───────────────────────────────────────────────────────
    let pairs: FloatingPair[] = [];
    let animFrame = 0;
    let lastTime  = 0;
    const TARGET_PAIRS = 5;
    const FADE_ZONE   = 120; // px fade region at top and bottom

    function draw(ts: number) {
      const delta = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      const W = window.innerWidth;
      const H = window.innerHeight;

      // Sky background
      ctx.fillStyle = SKY;
      ctx.fillRect(0, 0, W, H);

      if (!ready) {
        animFrame = requestAnimationFrame(draw);
        return;
      }

      // Ensure we always have TARGET_PAIRS in flight
      while (pairs.length < TARGET_PAIRS) pairs.push(spawnPair(W, H, true));

      for (let i = pairs.length - 1; i >= 0; i--) {
        const p = pairs[i];
        p.topY -= p.speed * delta;

        const gap  = p.bustW * 0.06;
        const left = p.x - p.bustW - gap / 2;

        // Fade: enters from bottom, exits top
        let alpha = 1;
        const bottomEdge = p.topY + p.bustH;
        if (bottomEdge > H)              alpha *= Math.max(0, 1 - (bottomEdge - H)   / FADE_ZONE);
        if (p.topY    < FADE_ZONE)       alpha *= Math.max(0, p.topY                  / FADE_ZONE + p.bustH / FADE_ZONE);
        if (alpha < 0.01)                alpha = 0;

        if (alpha > 0) {
          const [li, ri] = PAIRS[p.pairIdx];
          drawTinted(silhouettes[li], p.colorL, p.glow, left,            p.topY, p.bustW, p.bustH, alpha * 0.88);
          drawTinted(silhouettes[ri], p.colorR, p.glow, left + p.bustW + gap, p.topY, p.bustW, p.bustH, alpha * 0.88);
        }

        // Remove when completely off the top
        if (p.topY + p.bustH < -10) {
          pairs.splice(i, 1);
          pairs.push(spawnPair(W, H, true));
        }
      }

      animFrame = requestAnimationFrame(draw);
    }

    // ── Boot ─────────────────────────────────────────────────────────────────
    resize();

    const img = new Image();
    img.onload = () => {
      preprocessSprite(img);

      // Pre-populate pairs so screen isn't empty on load
      const W = window.innerWidth;
      const H = window.innerHeight;
      for (let i = 0; i < TARGET_PAIRS; i++) {
        pairs.push(spawnPair(W, H, false));
      }

      lastTime   = performance.now();
      animFrame  = requestAnimationFrame(draw);
    };
    img.src = spriteUrl;

    // Resize handler
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        resize();
      }, 120);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        display: 'block',
        background: SKY,
        pointerEvents: 'none',
      }}
    />
  );
}

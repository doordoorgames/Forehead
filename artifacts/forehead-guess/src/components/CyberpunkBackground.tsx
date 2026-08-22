import { useEffect, useRef } from 'react';

const SKY = '#13141a';
const BUILDING_COLORS = ['#0c0d11', '#0f1014', '#111318', '#0a0b0f'];
const NEON = ['#ff4fa3', '#39d5ff', '#ffd000']; // pink, blue, yellow
const SCROLL_PX_PER_SEC = 60; // pixels per second

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface Window_ { x: number; y: number; w: number; h: number; color: string; lit: boolean; }
interface Building {
  x: number;
  w: number;
  h: number;
  color: string;
  windows: Window_[];
}

function makeBuilding(startX: number, cityH: number): Building {
  const cols = randInt(3, 5);
  const floors = randInt(3, 20);

  const floorH = cityH / 22;                     // scale so 20-floor bldg ≈ 90% city height
  const winH = floorH * 0.55;
  const winGapY = floorH * 0.45;
  const winW = winH * 1.5;
  const winGapX = winH * 0.7;
  const padX = winH * 1.2;
  const padTop = winH * 1.2;
  const padBot = winH * 0.6;

  const w = padX * 2 + cols * winW + (cols - 1) * winGapX;
  const h = padTop + floors * winH + (floors - 1) * winGapY + padBot;

  const windows: Window_[] = [];
  for (let row = 0; row < floors; row++) {
    for (let col = 0; col < cols; col++) {
      const lit = Math.random() < 0.62;
      windows.push({
        x: padX + col * (winW + winGapX),
        y: padTop + row * (winH + winGapY),
        w: winW,
        h: winH,
        color: lit ? pick(NEON) : 'rgba(0,0,0,0)',
        lit,
      });
    }
  }

  return {
    x: startX,
    w,
    h,
    color: pick(BUILDING_COLORS),
    windows,
  };
}

function generateStrip(screenW: number, cityH: number): Building[] {
  const buildings: Building[] = [];
  let x = 0;
  while (x < screenW * 2.5) {
    const b = makeBuilding(x, cityH);
    buildings.push(b);
    x += b.w + randInt(2, 10);
  }
  return buildings;
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, offsetX: number, baseY: number) {
  const bx = b.x - offsetX;
  const by = baseY - b.h;

  ctx.fillStyle = b.color;
  ctx.fillRect(bx, by, b.w, b.h);

  for (const win of b.windows) {
    if (!win.lit) continue;
    const wx = bx + win.x;
    const wy = by + win.y;

    // Glow
    ctx.save();
    ctx.shadowColor = win.color;
    ctx.shadowBlur = win.h * 2.5;
    ctx.fillStyle = win.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(wx, wy, win.w, win.h);
    ctx.restore();
  }
}

export default function CyberpunkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let animFrame: number;
    let lastTime = 0;
    let offsetX = 0;
    let buildings: Building[] = [];
    let stripEndX = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);

      const cityH = window.innerHeight * 0.80;
      buildings = generateStrip(window.innerWidth, cityH);
      stripEndX = buildings[buildings.length - 1].x + buildings[buildings.length - 1].w;
      offsetX = 0;
    }

    function addMoreBuildings() {
      const cityH = window.innerHeight * 0.80;
      const screenW = window.innerWidth;
      // Add more when near the end
      while (stripEndX - offsetX < screenW + 400) {
        const b = makeBuilding(stripEndX, cityH);
        buildings.push(b);
        stripEndX += b.w + randInt(2, 10);
      }
      // Remove buildings that are far off-screen to the left
      while (buildings.length > 0 && buildings[0].x + buildings[0].w < offsetX - 100) {
        buildings.shift();
      }
    }

    function draw(timestamp: number) {
      const delta = Math.min((timestamp - lastTime) / 1000, 0.05); // seconds, capped
      lastTime = timestamp;

      const W = window.innerWidth;
      const H = window.innerHeight;
      const cityH = H * 0.80;
      const skyH = H * 0.20;
      const baseY = H;

      if (!reduceMotion) {
        offsetX += SCROLL_PX_PER_SEC * delta;
        addMoreBuildings();
      }

      ctx.clearRect(0, 0, W, H);

      // Sky gradient (top 20%)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH + cityH * 0.1);
      skyGrad.addColorStop(0, '#0e0f14');
      skyGrad.addColorStop(0.6, '#12131a');
      skyGrad.addColorStop(1, '#15161e');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Draw city layer
      for (const b of buildings) {
        const bx = b.x - offsetX;
        if (bx > W + 20) break;
        if (bx + b.w < -20) continue;
        drawBuilding(ctx, b, offsetX, baseY);
      }

      // Subtle horizon glow
      const glow = ctx.createLinearGradient(0, baseY - cityH * 0.06, 0, baseY);
      glow.addColorStop(0, 'rgba(255,70,160,0)');
      glow.addColorStop(1, 'rgba(255,70,160,0.07)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, baseY - cityH * 0.06, W, cityH * 0.06);

      animFrame = requestAnimationFrame(draw);
    }

    resize();
    lastTime = performance.now();
    animFrame = requestAnimationFrame(draw);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        resize();
      }, 150);
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

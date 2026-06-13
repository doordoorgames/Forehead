import { useEffect, useRef } from 'react';

const ITEMS = ['🎭', '👑', '⚽', '🎬', '🖌️', '🎨', '🏆', '⭐', '🎪', '🎠', '🎩', '🦁'];
const COLORS = ['#a855f7', '#ffd000', '#c084fc', '#f59e0b', '#7c3aed', '#fbbf24', '#d946ef', '#eab308'];

interface FloatingItem {
  x: number;
  y: number;
  emoji: string;
  size: number;
  speed: number;
  phase: number;
  amplitude: number;
  color: string;
  opacity: number;
  rotation: number;
  rotSpeed: number;
}

export default function CharadesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let animId: number;
    let items: FloatingItem[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnItems = () => {
      items = [];
      const count = Math.max(10, Math.floor(window.innerWidth / 130));
      for (let i = 0; i < count; i++) {
        items.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          emoji: ITEMS[Math.floor(Math.random() * ITEMS.length)],
          size: 36 + Math.random() * 56,
          speed: 0.12 + Math.random() * 0.28,
          phase: Math.random() * Math.PI * 2,
          amplitude: 18 + Math.random() * 38,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          opacity: 0.12 + Math.random() * 0.22,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.006,
        });
      }
    };
    spawnItems();

    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;

      // Deep warm canvas/parchment purple background
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#1a0832');
      grad.addColorStop(0.45, '#160624');
      grad.addColorStop(1, '#1e0a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Draw floating emoji items
      for (const item of items) {
        item.y -= item.speed;
        item.rotation += item.rotSpeed;

        if (item.y < -item.size * 2) {
          item.y = H + item.size;
          item.x = Math.random() * W;
          item.emoji = ITEMS[Math.floor(Math.random() * ITEMS.length)];
          item.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        }

        const wobbleX = item.x + Math.sin(t * 0.012 + item.phase) * item.amplitude;

        ctx.save();
        ctx.globalAlpha = item.opacity;
        ctx.translate(wobbleX, item.y);
        ctx.rotate(item.rotation);

        ctx.shadowBlur = 18;
        ctx.shadowColor = item.color;

        ctx.font = `${item.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, 0, 0);

        ctx.restore();
      }

      // Radial vignette
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      t++;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  );
}

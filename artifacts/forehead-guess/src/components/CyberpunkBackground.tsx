import { useEffect, useRef } from 'react';

const PALETTE = {
  building: ['#111215', '#17181c', '#1d1f24'],
  neon: ['#ff4fa3', '#ff7a2f', '#ff4d4d', '#39d5ff'],
};

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface LayerConfig {
  widthMin: number; widthMax: number;
  heightMin: number; heightMax: number;
  gapMin: number; gapMax: number;
  lightChance: number;
  roofChance: number;
  lampCount: number;
}

function createSegment(config: LayerConfig): HTMLDivElement {
  const segment = document.createElement('div');
  segment.style.cssText = 'position:relative;width:50%;height:100%;flex-shrink:0;';

  const width = window.innerWidth || 1400;
  let x = -40;

  while (x < width + 120) {
    const b = document.createElement('div');
    const w = randInt(config.widthMin, config.widthMax);
    const h = randInt(config.heightMin, config.heightMax);
    b.style.cssText = `position:absolute;bottom:0;overflow:hidden;left:${x}px;width:${w}px;height:${h}px;background:${pick(PALETTE.building)};`;

    if (Math.random() < config.roofChance) {
      const roof = document.createElement('div');
      roof.style.cssText = `position:absolute;background:rgba(255,255,255,0.08);opacity:0.4;width:${randInt(2, 4)}px;height:${randInt(10, 24)}px;left:${randInt(6, Math.max(7, w - 10))}px;bottom:${h - 2}px;`;
      segment.appendChild(roof);
    }

    const cols = Math.max(2, Math.floor(w / randInt(14, 18)));
    const rows = Math.max(2, Math.floor(h / randInt(18, 24)));
    const padX = randInt(6, 10);
    const padY = randInt(8, 12);
    const gapX = randInt(6, 10);
    const gapY = randInt(7, 11);
    const ww = Math.max(3, Math.floor((w - padX * 2 - gapX * (cols - 1)) / cols));
    const wh = randInt(4, 8);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const win = document.createElement('div');
        const lit = Math.random() < config.lightChance;
        const color = lit ? pick(PALETTE.neon) : 'rgba(255,255,255,0.04)';
        const blur = color === '#39d5ff' ? 7 : 6;
        win.style.cssText = `
          position:absolute;border-radius:1px;
          width:${ww}px;height:${wh}px;
          left:${padX + col * (ww + gapX)}px;top:${padY + row * (wh + gapY)}px;
          background:${color};
          transition:opacity 2.8s ease,filter 2.8s ease,box-shadow 2.8s ease;
          ${lit ? `opacity:0.9;box-shadow:0 0 ${blur}px ${color};` : 'opacity:0.22;'}
        `;
        if (lit) {
          win.className = 'cb-win';
          win.dataset.lit = '1';
          win.dataset.base = color;
        } else {
          win.dataset.lit = '0';
        }
        b.appendChild(win);
      }
    }

    segment.appendChild(b);
    x += w + randInt(config.gapMin, config.gapMax);
  }

  for (let i = 0; i < config.lampCount; i++) {
    const lamp = document.createElement('div');
    const glow = pick(['#ff4fa3', '#ff7a2f', '#ff4d4d']);
    const lampH = randInt(16, 34);
    lamp.style.cssText = `position:absolute;bottom:10px;left:${randInt(0, width)}px;width:4px;height:${lampH}px;background:rgba(255,255,255,0.08);transform:rotate(${rand(-8, 8)}deg);transform-origin:bottom center;`;
    const head = document.createElement('div');
    head.style.cssText = `position:absolute;left:50%;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;bottom:100%;opacity:0.9;background:${glow};box-shadow:0 0 10px ${glow},0 0 18px ${glow};`;
    lamp.appendChild(head);
    segment.appendChild(lamp);
  }

  return segment;
}

function fillTrack(track: HTMLElement, config: LayerConfig) {
  track.innerHTML = '';
  track.style.cssText = 'position:absolute;left:0;bottom:0;width:200%;height:100%;display:flex;';
  track.appendChild(createSegment(config));
  track.appendChild(createSegment(config));
}

export default function CyberpunkBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const twinkleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resizeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const backTrack = container.querySelector('#cb-back-track') as HTMLElement;
    const midTrack = container.querySelector('#cb-mid-track') as HTMLElement;
    const frontTrack = container.querySelector('#cb-front-track') as HTMLElement;

    function build() {
      fillTrack(backTrack, { widthMin:70, widthMax:150, heightMin:50, heightMax:120, gapMin:10, gapMax:26, lightChance:0.04, roofChance:0.1, lampCount:0 });
      fillTrack(midTrack, { widthMin:80, widthMax:180, heightMin:70, heightMax:160, gapMin:12, gapMax:28, lightChance:0.07, roofChance:0.14, lampCount:2 });
      fillTrack(frontTrack, { widthMin:90, widthMax:210, heightMin:80, heightMax:175, gapMin:14, gapMax:30, lightChance:0.10, roofChance:0.18, lampCount:4 });

      if (!reduceMotion) startTwinkle();
    }

    function startTwinkle() {
      if (twinkleRef.current) clearInterval(twinkleRef.current);
      twinkleRef.current = setInterval(() => {
        const litWindows = [...container.querySelectorAll<HTMLElement>('.cb-win[data-lit="1"]')];
        if (!litWindows.length) return;
        const batch = litWindows.sort(() => 0.5 - Math.random()).slice(0, Math.max(3, Math.floor(litWindows.length * 0.015)));
        batch.forEach((win, i) => {
          const base = win.dataset.base || '#ff7a2f';
          const dim = Math.random() < 0.65;
          setTimeout(() => {
            win.style.opacity = dim ? '0.3' : '1';
            win.style.boxShadow = dim ? 'none' : `0 0 8px ${base}`;
            setTimeout(() => {
              win.style.opacity = '0.9';
              win.style.boxShadow = `0 0 6px ${base}`;
            }, 1800);
          }, i * 120);
        });
      }, 5000);
    }

    build();

    const onResize = () => {
      if (resizeRef.current) clearTimeout(resizeRef.current);
      resizeRef.current = setTimeout(build, 180);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (twinkleRef.current) clearInterval(twinkleRef.current);
      if (resizeRef.current) clearTimeout(resizeRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: 'linear-gradient(to bottom, #232326 0%, #202126 48%, #1b1b1f 100%)',
        pointerEvents: 'none',
      }}
    >
      {/* Sky fog */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: '18vh', height: '18vh',
        background: 'linear-gradient(to top, rgba(255,120,80,0.04), transparent)',
        filter: 'blur(8px)', pointerEvents: 'none',
      }} />

      {/* City layers */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: '30vh', minHeight: '160px', pointerEvents: 'none',
      }}>
        {/* Back layer */}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: '200%', height: '100%',
          opacity: 0.22, filter: 'blur(0.8px)',
          willChange: 'transform',
          animation: 'cbDriftBack 180s linear infinite',
        }}>
          <div id="cb-back-track" />
        </div>

        {/* Mid layer */}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: '200%', height: '100%',
          opacity: 0.48,
          willChange: 'transform',
          animation: 'cbDriftMid 120s linear infinite',
        }}>
          <div id="cb-mid-track" />
        </div>

        {/* Front layer */}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: '200%', height: '100%',
          opacity: 0.90,
          willChange: 'transform',
          animation: 'cbDriftFront 90s linear infinite',
        }}>
          <div id="cb-front-track" />
        </div>

        {/* Ground glow */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '8vh',
          background: 'linear-gradient(to top, rgba(255,90,90,0.04), transparent)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

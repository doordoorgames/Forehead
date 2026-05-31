import { useEffect, useRef } from 'react';

const KEYFRAMES_ID = 'petal-swoop-keyframes';
const KEYFRAMES_CSS = `
@keyframes petalSwoopAnim {
  0%   { opacity: 0;          transform: translate(0px, 0px) rotate(var(--rs)) scale(1);    }
  10%  { opacity: var(--op);  }
  88%  { opacity: var(--op);  }
  100% { opacity: 0;          transform: translate(var(--dx), var(--dy)) rotate(var(--re)) scale(0.6); }
}
`;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function spawnPetal(holder: HTMLDivElement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const size    = rand(7, 17);
  const opacity = rand(0.35, 0.72);
  const dur     = rand(4, 7);
  const delay   = rand(0, 2.4);

  const startX  = rand(vw * 0.55, vw * 1.12);
  const startY  = rand(vh * 0.55, vh * 1.12);
  const dx      = rand(-vw * 0.88, -vw * 0.32);
  const dy      = rand(-vh * 0.88, -vh * 0.38);

  const rotStart = rand(-20, 200);
  const rotEnd   = rotStart + rand(-240, -90);

  const el = document.createElement('div');

  el.style.position      = 'fixed';
  el.style.left          = `${startX}px`;
  el.style.top           = `${startY}px`;
  el.style.width         = `${size}px`;
  el.style.height        = `${size * 1.5}px`;
  el.style.background    = 'radial-gradient(ellipse at 38% 26%, #ff6666 0%, #cc1414 52%, #780000 100%)';
  el.style.borderRadius  = '50% 50% 50% 8% / 60% 60% 40% 12%';
  el.style.boxShadow     = 'inset -1px -2px 4px rgba(0,0,0,0.28), inset 1px 1px 3px rgba(255,150,150,0.22)';
  el.style.pointerEvents = 'none';
  el.style.zIndex        = '15';
  el.style.animation     = `petalSwoopAnim ${dur}s ${delay}s ease-in-out both`;
  el.style.willChange    = 'transform, opacity';

  el.style.setProperty('--op', String(opacity));
  el.style.setProperty('--dx', `${dx}px`);
  el.style.setProperty('--dy', `${dy}px`);
  el.style.setProperty('--rs', `${rotStart}deg`);
  el.style.setProperty('--re', `${rotEnd}deg`);

  holder.appendChild(el);

  const cleanupMs = (dur + delay + 0.3) * 1000;
  setTimeout(() => el.remove(), cleanupMs);
}

export default function PetalSwoop() {
  const holderRef = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!document.getElementById(KEYFRAMES_ID)) {
      const s = document.createElement('style');
      s.id          = KEYFRAMES_ID;
      s.textContent = KEYFRAMES_CSS;
      document.head.appendChild(s);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const holder = holderRef.current;
    if (!holder) return;

    function swoop() {
      const count = Math.floor(rand(3, 13));
      for (let i = 0; i < count; i++) spawnPetal(holder!);
      timerRef.current = setTimeout(swoop, rand(10_000, 15_000));
    }

    timerRef.current = setTimeout(swoop, rand(2_000, 5_000));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (holder) holder.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={holderRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 15, overflow: 'hidden' }}
    />
  );
}

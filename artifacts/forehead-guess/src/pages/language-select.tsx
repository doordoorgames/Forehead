import { useLocation } from 'wouter';
import { useLang } from '@/context/LanguageContext';
import { Lang } from '@/i18n/translations';
import khaminLogo from '@assets/IMG_1974_1780586546169.png';

export default function LanguageSelect({ nextPath = '/mode' }: { nextPath?: string }) {
  const [, setLocation] = useLocation();
  const { setLang } = useLang();

  const choose = (l: Lang) => {
    setLang(l);
    setLocation(nextPath);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm">
        <div className="text-center">
          <img
            src={khaminLogo}
            alt="Khamin"
            style={{
              width: 'clamp(220px, 72vw, 380px)',
              display: 'block',
              margin: '0 auto',
              mixBlendMode: 'screen',
            }}
          />
        </div>

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={() => choose('en')}
            className="w-full h-20 text-3xl font-black text-white transition-transform active:scale-95"
            style={{
              background: '#ff4fa3',
              borderRadius: 0,
              border: 'none',
              boxShadow: '0 6px 0 #a8005a, 0 0 30px rgba(255,79,163,0.4)',
              fontFamily: "Arial, 'Helvetica Neue', sans-serif",
              fontWeight: 900,
              letterSpacing: '0.05em',
            }}
          >
            English
          </button>

          <button
            onClick={() => choose('ar')}
            className="w-full h-20 text-4xl text-black transition-transform active:scale-95"
            style={{
              background: '#ffe600',
              borderRadius: 0,
              border: 'none',
              boxShadow: '0 6px 0 #a89600, 0 0 30px rgba(255,230,0,0.4)',
              fontFamily: "'Changa', 'Arial', sans-serif",
              fontWeight: 900,
              direction: 'rtl',
            }}
          >
            عربي
          </button>
        </div>
      </div>
    </div>
  );
}

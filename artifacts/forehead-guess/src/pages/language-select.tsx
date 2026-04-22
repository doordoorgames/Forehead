import { useLocation } from 'wouter';
import { useLang } from '@/context/LanguageContext';
import { Lang } from '@/i18n/translations';

export default function LanguageSelect() {
  const [, setLocation] = useLocation();
  const { setLang } = useLang();

  const choose = (l: Lang) => {
    setLang(l);
    setLocation('/home');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm">
        <div className="text-center">
          <h1 className="neon-word leading-none" style={{ fontSize: 'clamp(52px, 14vw, 110px)' }}>
            <span className="block">Forehead</span>
            <span className="block" style={{ color: '#ff4fa3' }}>Guess</span>
          </h1>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={() => choose('en')}
            className="w-full h-20 rounded-3xl text-3xl font-black text-white transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #ff4fa3 0%, #c026a0 100%)',
              boxShadow: '0 6px 0 #8b0057, 0 0 30px rgba(255,79,163,0.4)',
              fontFamily: "'Bebas Neue', 'Impact', sans-serif",
              letterSpacing: '0.05em',
            }}
          >
            English
          </button>

          <button
            onClick={() => choose('ar')}
            className="w-full h-20 rounded-3xl text-4xl text-white transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #39d5ff 0%, #0891b2 100%)',
              boxShadow: '0 6px 0 #0e5f7a, 0 0 30px rgba(57,213,255,0.4)',
              fontFamily: "'Changa', 'Arial', sans-serif",
              fontWeight: 800,
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

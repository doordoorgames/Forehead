import { useLocation } from 'wouter';
import { useLang } from '@/context/LanguageContext';

export default function ModeSelect() {
  const [, setLocation] = useLocation();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';

  const fontStyle = isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 800 } : {};

  const choose = (mode: 'forehead' | 'character') => {
    localStorage.setItem('fg_mode', mode);
    setLocation('/home');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-3xl" />

      <div className="max-w-md w-full relative z-10 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <h1
            className="neon-word leading-none mb-2"
            style={{ fontSize: 'clamp(36px, 10vw, 80px)', ...fontStyle }}
          >
            {t.chooseMode}
          </h1>
        </div>

        <div className="flex flex-col gap-5">
          {/* Forehead Game */}
          <button
            onClick={() => choose('forehead')}
            className="group relative w-full overflow-hidden rounded-3xl border-4 border-[#ff4fa3] bg-black/60 backdrop-blur-sm p-6 text-left transition-all duration-200 hover:scale-[1.02] hover:bg-[#ff4fa3]/10 active:scale-[0.98] shadow-[0_0_24px_#ff4fa340]"
          >
            <div className="flex items-center gap-4">
              <span className="text-5xl">🧠</span>
              <div>
                <p
                  className="text-2xl font-black text-[#ff4fa3]"
                  style={fontStyle}
                >
                  {t.foreheadGame}
                </p>
                <p className="text-sm text-muted-foreground mt-1" style={fontStyle}>
                  {t.foreheadGameDesc}
                </p>
              </div>
            </div>
          </button>

          {/* Guess the Character */}
          <button
            onClick={() => choose('character')}
            className="group relative w-full overflow-hidden rounded-3xl border-4 border-[#39d5ff] bg-black/60 backdrop-blur-sm p-6 text-left transition-all duration-200 hover:scale-[1.02] hover:bg-[#39d5ff]/10 active:scale-[0.98] shadow-[0_0_24px_#39d5ff40]"
          >
            <div className="flex items-center gap-4">
              <span className="text-5xl">🕵️</span>
              <div>
                <p
                  className="text-2xl font-black text-[#39d5ff]"
                  style={fontStyle}
                >
                  {t.guessTheCharacter}
                </p>
                <p className="text-sm text-muted-foreground mt-1" style={fontStyle}>
                  {t.guessTheCharacterDesc}
                </p>
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={() => setLocation('/')}
          className="text-muted-foreground text-sm underline underline-offset-4 mx-auto hover:text-foreground transition-colors"
          style={fontStyle}
        >
          {t.back}
        </button>
      </div>
    </div>
  );
}

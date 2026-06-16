import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import PetalSwoop from '@/components/PetalSwoop';
import grassBg from '@assets/6E21F754-65A0-4119-A739-67DD40CAA6B4_1780250343871.png';
import charadesBg3 from '@assets/IMG_2041_1781444797139.png';
import charadesBgRect from '@assets/398199A7-F3AA-42BA-9585-D50E4BFBCD6C_1781444797139.png';
import khaminLogo from '@assets/IMG_1974_1780586546169.png';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateRoom, useJoinRoom } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/context/LanguageContext';

const createRoomSchema = z.object({
  hostName: z.string().min(1).max(20),
});

const joinRoomSchema = z.object({
  roomCode: z.string().length(5).toUpperCase(),
  playerName: z.string().min(1).max(20),
});

const modeBackPath: Record<string, string> = {
  forehead: '/forehead',
  character: '/character',
  charades: '/charades',
  dykm: '/dykm',
};

export default function Home({ mode }: { mode: 'forehead' | 'character' | 'charades' | 'dykm' }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, lang, setLang } = useLang();
  const [view, setView] = useState<'main' | 'create' | 'join'>('main');

  const createRoomMutation = useCreateRoom();
  const joinRoomMutation = useJoinRoom();

  const createForm = useForm<z.infer<typeof createRoomSchema>>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { hostName: '' },
  });

  const joinForm = useForm<z.infer<typeof joinRoomSchema>>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: { roomCode: '', playerName: '' },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preCode = params.get('room');
    if (preCode) {
      joinForm.setValue('roomCode', preCode.toUpperCase().slice(0, 5));
      setView('join');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onCreateSubmit = (values: z.infer<typeof createRoomSchema>) => {
    console.log('[CreateRoom] submitting', { hostName: values.hostName, mode, lang });
    createRoomMutation.mutate(
      { data: { hostName: values.hostName, mode, lang } },
      {
        onSuccess: (data) => {
          console.log('[CreateRoom] success', data);
          const host = data.players.find(p => p.isHost);
          try {
            if (host) {
              sessionStorage.setItem(`fg_playerId_${data.code}`, String(host.id));
              sessionStorage.setItem(`fg_playerName_${data.code}`, host.name);
              sessionStorage.setItem(`fg_roomMode_${data.code}`, mode);
            }
          } catch (storageErr) {
            console.warn('[CreateRoom] sessionStorage failed (non-fatal):', storageErr);
          }
          setLocation(`/room/${data.code}`);
        },
        onError: (err) => {
          console.error('[CreateRoom] error', err);
          const msg = err instanceof Error ? err.message : String(err);
          toast({ title: t.errorTitle, description: msg || t.errorCreate, variant: 'destructive' });
        }
      }
    );
  };

  const onJoinSubmit = (values: z.infer<typeof joinRoomSchema>) => {
    console.log('[JoinRoom] submitting', { roomCode: values.roomCode, playerName: values.playerName });
    joinRoomMutation.mutate(
      { code: values.roomCode, data: { playerName: values.playerName } },
      {
        onSuccess: (data) => {
          console.log('[JoinRoom] success', data);
          try {
            sessionStorage.setItem(`fg_playerId_${data.room.code}`, String(data.playerId));
            sessionStorage.setItem(`fg_playerName_${data.room.code}`, data.playerName);
            sessionStorage.setItem(`fg_roomMode_${data.room.code}`, mode);
          } catch (storageErr) {
            console.warn('[JoinRoom] sessionStorage failed (non-fatal):', storageErr);
          }
          setLocation(`/room/${data.room.code}`);
        },
        onError: (err) => {
          console.error('[JoinRoom] error', err);
          const msg = err instanceof Error ? err.message : String(err);
          toast({ title: t.errorTitle, description: msg || t.errorJoin, variant: 'destructive' });
        }
      }
    );
  };

  const isAr = lang === 'ar';

  // ──── CHARADES SPECIAL LAYOUTS ────────────────────────────────────────────
  if (mode === 'charades' && view === 'main') {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, overflow: 'hidden',
          backgroundImage: `url(${charadesBg3})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        {/* Create Room — left rectangle (~53-63% h, 6-47% w) */}
        <button
          onClick={() => setView('create')}
          style={{
            position: 'absolute', top: '53%', left: '6%', width: '41%', height: '10%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#3b1700', fontWeight: 900,
            fontSize: 'clamp(13px, 3.5vw, 18px)',
            fontFamily: isAr ? "'Changa', sans-serif" : "'Arial', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {t.createRoom}
        </button>

        {/* Join Room — right rectangle (~53-63% h, 53-94% w) */}
        <button
          onClick={() => setView('join')}
          style={{
            position: 'absolute', top: '53%', left: '53%', width: '41%', height: '10%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#3b1700', fontWeight: 900,
            fontSize: 'clamp(13px, 3.5vw, 18px)',
            fontFamily: isAr ? "'Changa', sans-serif" : "'Arial', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {t.joinRoom}
        </button>

        {/* Language toggle — bottom rectangle (~63-76% h, 6-92% w) */}
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          style={{
            position: 'absolute', top: '63%', left: '6%', width: '88%', height: '13%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#3b1700', fontWeight: 900,
            fontSize: 'clamp(13px, 3.5vw, 18px)',
            fontFamily: "'Changa', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {lang === 'ar' ? 'English' : 'عربية'}
        </button>

        <a
          href="https://dordor.games/"
          style={{
            position: 'absolute', bottom: '3%', left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,200,80,0.7)', fontSize: '11px',
            textDecoration: 'underline', whiteSpace: 'nowrap', zIndex: 10,
          }}
        >
          ← Back to Dordor.games
        </a>
      </div>
    );
  }

  const CHARADES_TEXT: React.CSSProperties = {
    color: '#000',
    textShadow: '1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff',
    fontFamily: isAr ? "'Changa', sans-serif" : "'Arial', sans-serif",
  };

  if (mode === 'charades' && view === 'create') {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, overflow: 'hidden',
          backgroundImage: `url(${charadesBgRect})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <Form {...createForm}>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
            {/* Label + input overlaid on big rectangle */}
            <div
              style={{
                position: 'absolute',
                top: '38%', left: '5%', width: '90%', height: '20%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '0 12px',
              }}
            >
              <p
                style={{
                  ...CHARADES_TEXT,
                  fontWeight: 800,
                  fontSize: 'clamp(14px, 3.8vw, 18px)',
                  textAlign: 'center',
                }}
              >
                {t.yourName}
              </p>
              <FormField
                control={createForm.control}
                name="hostName"
                render={({ field }) => (
                  <FormItem style={{ width: '100%' }}>
                    <FormControl>
                      <Input
                        placeholder={t.namePlaceholder}
                        className="text-lg h-10 text-center"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '2px solid rgba(0,0,0,0.5)',
                          borderRadius: 0,
                          boxShadow: 'none',
                          color: '#000',
                          fontFamily: isAr ? "'Changa', sans-serif" : undefined,
                          fontWeight: 700,
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Back — bottom left */}
            <button
              type="button"
              onClick={() => setView('main')}
              style={{
                position: 'absolute', bottom: '10%', left: '5%',
                background: 'transparent', border: 'none',
                padding: '8px 20px', cursor: 'pointer',
                ...CHARADES_TEXT, fontWeight: 700,
                fontSize: 'clamp(12px, 3vw, 16px)',
              }}
            >
              {t.back}
            </button>

            {/* Create Room — bottom right */}
            <button
              type="submit"
              disabled={createRoomMutation.isPending}
              style={{
                position: 'absolute', bottom: '10%', right: '5%',
                background: 'transparent', border: 'none',
                padding: '8px 24px', cursor: 'pointer',
                ...CHARADES_TEXT, fontWeight: 900,
                fontSize: 'clamp(14px, 3.5vw, 18px)',
              }}
            >
              {createRoomMutation.isPending ? '...' : t.createRoom}
            </button>
          </form>
        </Form>
      </div>
    );
  }

  if (mode === 'charades' && view === 'join') {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, overflow: 'hidden',
          backgroundImage: `url(${charadesBgRect})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <Form {...joinForm}>
          <form onSubmit={joinForm.handleSubmit(onJoinSubmit)}>
            {/* Two inputs overlaid on big rectangle */}
            <div
              style={{
                position: 'absolute',
                top: '36%', left: '5%', width: '90%', height: '24%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '0 12px',
              }}
            >
              <FormField
                control={joinForm.control}
                name="roomCode"
                render={({ field }) => (
                  <FormItem style={{ width: '100%' }}>
                    <FormControl>
                      <Input
                        placeholder="XXXXX"
                        maxLength={5}
                        className="text-xl h-10 text-center font-black tracking-widest uppercase"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '2px solid rgba(0,0,0,0.5)',
                          borderRadius: 0,
                          boxShadow: 'none',
                          color: '#000',
                          letterSpacing: '0.15em',
                        }}
                        {...field}
                        onChange={e => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={joinForm.control}
                name="playerName"
                render={({ field }) => (
                  <FormItem style={{ width: '100%' }}>
                    <FormControl>
                      <Input
                        placeholder={t.namePlaceholder}
                        className="text-lg h-10 text-center"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '2px solid rgba(0,0,0,0.5)',
                          borderRadius: 0,
                          boxShadow: 'none',
                          color: '#000',
                          fontFamily: isAr ? "'Changa', sans-serif" : undefined,
                          fontWeight: 700,
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Back — bottom left */}
            <button
              type="button"
              onClick={() => setView('main')}
              style={{
                position: 'absolute', bottom: '10%', left: '5%',
                background: 'transparent', border: 'none',
                padding: '8px 20px', cursor: 'pointer',
                ...CHARADES_TEXT, fontWeight: 700,
                fontSize: 'clamp(12px, 3vw, 16px)',
              }}
            >
              {t.back}
            </button>

            {/* Join Room — bottom right */}
            <button
              type="submit"
              disabled={joinRoomMutation.isPending}
              style={{
                position: 'absolute', bottom: '10%', right: '5%',
                background: 'transparent', border: 'none',
                padding: '8px 24px', cursor: 'pointer',
                ...CHARADES_TEXT, fontWeight: 900,
                fontSize: 'clamp(14px, 3.5vw, 18px)',
              }}
            >
              {joinRoomMutation.isPending ? '...' : t.joinRoom}
            </button>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Character mode: replace the cyberpunk city with the vending-machine scene */}
      {mode === 'character' && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url('/character-bg.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.52)' }} />
        </>
      )}
      {/* DYKM mode: grass garden background */}
      {mode === 'dykm' && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(10,28,10,0.22), rgba(10,28,10,0.22)), url(${grassBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <PetalSwoop />
        </>
      )}
      {mode !== 'character' && mode !== 'dykm' && mode !== 'charades' && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-3xl" />
        </>
      )}

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {mode === 'forehead' && (
            <img
              src={khaminLogo}
              alt="Khamin"
              style={{
                width: 'clamp(220px, 68vw, 400px)',
                display: 'block',
                margin: '0 auto 4px',
                mixBlendMode: 'screen',
              }}
            />
          )}
          {mode === 'character' && (
            <div className="mb-4 flex flex-col items-center gap-2">
              <div style={{
                width: 'clamp(320px, 90vw, 720px)',
                height: 'clamp(160px, 45vw, 360px)',
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                <img
                  src="/character-neon-logo-nobg.png"
                  alt="خمّن"
                  style={{
                    width: '100%',
                    display: 'block',
                    marginTop: '-25%',
                    filter: [
                      'drop-shadow(0 0 6px #c219a6)',
                      'drop-shadow(0 0 16px #c219a6)',
                      'drop-shadow(0 0 32px rgba(194,25,166,0.75))',
                    ].join(' '),
                  }}
                />
              </div>
              <p
                className="font-black leading-tight"
                style={{
                  fontSize: 'clamp(24px, 6.5vw, 46px)',
                  color: '#c219a6',
                  textShadow: '0 0 5px white',
                  fontFamily: "'Changa', sans-serif",
                  direction: 'rtl',
                }}
              >
                خمّن الشخصية
              </p>
              <p
                className="font-black leading-tight tracking-widest"
                style={{
                  fontSize: 'clamp(13px, 3.5vw, 22px)',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  textShadow: '0 1px 0 rgba(255,255,255,0.5)',
                }}
              >
                Guess the Character
              </p>
            </div>
          )}
          {mode === 'charades' && (
            <h1
              className="neon-word mb-4 leading-none"
              style={{
                fontSize: 'clamp(48px, 13vw, 100px)',
                color: '#a855f7',
                fontFamily: isAr ? "'Changa', sans-serif" : undefined,
              }}
            >
              {t.charadesMode}
            </h1>
          )}
          {mode === 'dykm' && (
            <div className="mb-4 flex flex-col items-center gap-1" style={{
              background: 'rgba(253,246,238,0.92)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              padding: '18px 28px 14px',
              borderRadius: 0,
              border: '2px solid rgba(139,0,0,0.35)',
              boxShadow: '4px 4px 0 rgba(139,0,0,0.18)',
            }}>
              <div style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 'clamp(11px, 2.5vw, 14px)',
                color: '#3d7a6a',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                MEMORY ARCHIVE
              </div>
              <h1 style={{
                fontFamily: isAr ? "'Changa', sans-serif" : "Georgia, 'Times New Roman', serif",
                fontSize: isAr ? 'clamp(36px, 10vw, 72px)' : 'clamp(26px, 7vw, 52px)',
                fontWeight: 900,
                color: '#8b0000',
                letterSpacing: isAr ? undefined : '0.04em',
                lineHeight: 1.1,
                textShadow: '2px 2px 0 rgba(139,0,0,0.25)',
                direction: isAr ? 'rtl' : undefined,
              }}>
                {t.dykmMode}
              </h1>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 'clamp(10px, 2.2vw, 13px)',
                color: '#8b0000',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                opacity: 0.7,
              }}>
                DO YOU KNOW ME ?
              </p>
            </div>
          )}
        </div>

        {view === 'main' && (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
            {mode === 'dykm' ? (
              <>
                <button
                  className="w-full text-xl h-16 font-black tracking-wide transition-transform active:scale-95"
                  style={{
                    background: '#fdf6ee',
                    border: '2px solid #8b0000',
                    borderRadius: 0,
                    color: '#8b0000',
                    textShadow: 'none',
                    boxShadow: '4px 4px 0 rgba(139,0,0,0.4)',
                    fontFamily: isAr ? "'Changa', sans-serif" : "Georgia, 'Times New Roman', serif",
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                  onClick={() => setView('create')}
                >
                  {t.createRoom}
                </button>
                <button
                  className="w-full text-xl h-16 font-black tracking-wide transition-transform active:scale-95"
                  style={{
                    background: '#8b0000',
                    border: '2px solid #8b0000',
                    borderRadius: 0,
                    color: 'white',
                    textShadow: 'none',
                    boxShadow: '4px 4px 0 rgba(139,0,0,0.4)',
                    fontFamily: isAr ? "'Changa', sans-serif" : "Georgia, 'Times New Roman', serif",
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                  onClick={() => setView('join')}
                >
                  {t.joinRoom}
                </button>
              </>
            ) : mode === 'character' ? (
              <>
                <button
                  className="w-full text-xl h-16 font-black text-white tracking-wide transition-transform active:scale-95"
                  style={{
                    background: 'transparent',
                    border: '2px solid #c219a6',
                    borderRadius: 0,
                    color: '#c219a6',
                    textShadow: '0 0 8px #c219a6',
                    boxShadow: '0 0 12px rgba(194,25,166,0.6), inset 0 0 12px rgba(194,25,166,0.08)',
                    ...(isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 700 } : {}),
                  }}
                  onClick={() => setView('create')}
                >
                  {t.createRoom}
                </button>
                <button
                  className="w-full text-xl h-16 font-black tracking-wide transition-transform active:scale-95"
                  style={{
                    background: 'transparent',
                    border: '2px solid #39d5ff',
                    borderRadius: 0,
                    color: '#39d5ff',
                    textShadow: '0 0 8px #39d5ff',
                    boxShadow: '0 0 12px rgba(57,213,255,0.6), inset 0 0 12px rgba(57,213,255,0.08)',
                    ...(isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 700 } : {}),
                  }}
                  onClick={() => setView('join')}
                >
                  {t.joinRoom}
                </button>
              </>
            ) : mode === 'forehead' ? (
              <>
                <button
                  className="w-full text-xl h-16 font-black tracking-wide transition-transform active:scale-95"
                  style={{
                    background: '#ff4fa3',
                    border: 'none',
                    borderRadius: 0,
                    color: 'white',
                    fontFamily: "Arial, 'Helvetica Neue', sans-serif",
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    boxShadow: '0 5px 0 #a8005a, 0 0 24px rgba(255,79,163,0.5)',
                  }}
                  onClick={() => setView('create')}
                >
                  {t.createRoom}
                </button>
                <button
                  className="w-full text-xl h-16 font-black tracking-wide transition-transform active:scale-95"
                  style={{
                    background: '#ffe600',
                    border: 'none',
                    borderRadius: 0,
                    color: '#000',
                    fontFamily: "Arial, 'Helvetica Neue', sans-serif",
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    boxShadow: '0 5px 0 #a89600, 0 0 24px rgba(255,230,0,0.4)',
                  }}
                  onClick={() => setView('join')}
                >
                  {t.joinRoom}
                </button>
                <button
                  type="button"
                  onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                  className="w-full h-12 font-bold tracking-wide transition-all active:scale-95 border-2"
                  style={{
                    fontFamily: isAr ? "'Changa', sans-serif" : "Arial, 'Helvetica Neue', sans-serif",
                    fontSize: '1.1rem',
                    color: '#ff4fa3',
                    borderColor: 'rgba(255,79,163,0.5)',
                    background: 'rgba(255,79,163,0.08)',
                    borderRadius: 0,
                  }}
                >
                  {lang === 'ar' ? 'English' : 'عربية'}
                </button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="w-full text-xl h-16 rounded-full shadow-[0_6px_0_0_hsl(var(--primary-border))]"
                  style={isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 700 } : {}}
                  onClick={() => setView('create')}
                >
                  {t.createRoom}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full text-xl h-16 rounded-full shadow-[0_6px_0_0_hsl(var(--secondary-border))]"
                  style={isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 700 } : {}}
                  onClick={() => setView('join')}
                >
                  {t.joinRoom}
                </Button>
                <button
                  type="button"
                  onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                  className="w-full h-12 font-bold tracking-wide transition-all active:scale-95 border-2 rounded-full"
                  style={{
                    fontFamily: "'Changa', sans-serif",
                    fontSize: '1.1rem',
                    color: '#a855f7',
                    borderColor: 'rgba(168,85,247,0.5)',
                    background: 'rgba(168,85,247,0.08)',
                  }}
                >
                  {lang === 'ar' ? 'English' : 'عربية'}
                </button>
              </>
            )}

            <a
              href="https://dordor.games/"
              className="mt-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors text-center"
            >
              ← Back to Dordor.games
            </a>
            <Button variant="ghost" className="mt-2" onClick={() => setLocation('/admin')}>
              {t.adminPanel}
            </Button>
          </div>
        )}

        {view === 'create' && (
          <Card
            className="animate-in slide-in-from-right-8 duration-300"
            style={mode === 'character' ? {
              borderRadius: 0,
              border: '2px solid rgba(57,213,255,0.65)',
              background: 'rgba(0,4,18,0.88)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 0 28px rgba(57,213,255,0.2)',
            } : mode === 'dykm' ? {
              borderRadius: 0,
              border: '2px solid #8b0000',
              background: '#fdf6ee',
              boxShadow: '4px 4px 0 rgba(139,0,0,0.4)',
            } : mode === 'forehead' ? {
              borderRadius: 0,
              border: '2px solid #ff4fa3',
              background: 'rgba(0,0,0,0.9)',
              boxShadow: '0 0 28px rgba(255,79,163,0.2)',
            } : undefined}
          >
            <CardHeader>
              <CardTitle
                className="text-2xl"
                style={mode === 'character' ? { color: '#39d5ff', textShadow: '0 0 10px rgba(57,213,255,0.7)' } : mode === 'dykm' ? { color: '#8b0000', fontFamily: "Georgia, 'Times New Roman', serif" } : mode === 'forehead' ? { color: '#ff4fa3', fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 900 } : undefined}
              >
                {t.createRoomTitle}
              </CardTitle>
              <CardDescription style={mode === 'character' ? { color: 'rgba(255,255,255,0.55)' } : mode === 'dykm' ? { color: '#5a0a0a', fontFamily: "Georgia, 'Times New Roman', serif" } : mode === 'forehead' ? { color: 'rgba(255,255,255,0.6)' } : undefined}>
                {t.createRoomDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
                  <FormField
                    control={createForm.control}
                    name="hostName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel
                          className="text-lg font-bold"
                          style={mode === 'character' ? { color: 'rgba(255,255,255,0.85)' } : mode === 'dykm' ? { color: '#8b0000', fontFamily: "Georgia, 'Times New Roman', serif" } : mode === 'forehead' ? { color: '#ff4fa3', fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 700 } : undefined}
                        >
                          {t.yourName}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t.namePlaceholder}
                            className="text-xl h-14 border-2"
                            style={mode === 'character' ? {
                              borderRadius: 0,
                              border: '2px solid rgba(57,213,255,0.5)',
                              background: 'rgba(0,0,0,0.55)',
                              color: 'white',
                              boxShadow: '0 0 8px rgba(57,213,255,0.15)',
                            } : mode === 'dykm' ? {
                              borderRadius: 0,
                              border: '2px solid #8b0000',
                              background: '#ffffff',
                              color: '#1a0505',
                              fontFamily: "Georgia, 'Times New Roman', serif",
                            } : mode === 'forehead' ? {
                              borderRadius: 0,
                              border: '2px solid #ff4fa3',
                              background: 'rgba(0,0,0,0.8)',
                              color: 'white',
                              fontFamily: "Arial, 'Helvetica Neue', sans-serif",
                              boxShadow: '0 0 8px rgba(255,79,163,0.2)',
                            } : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 px-6"
                      style={mode === 'character' ? {
                        borderRadius: 0,
                        border: '2px solid rgba(255,255,255,0.25)',
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.7)',
                      } : mode === 'dykm' ? {
                        borderRadius: 0,
                        border: '2px solid #8b0000',
                        background: 'transparent',
                        color: '#8b0000',
                      } : mode === 'forehead' ? {
                        borderRadius: 0,
                        border: '2px solid rgba(255,255,255,0.35)',
                        background: 'transparent',
                        color: 'white',
                      } : { borderRadius: '1rem' }}
                      onClick={() => setView('main')}
                    >
                      {t.back}
                    </Button>
                    <Button
                      type="submit"
                      className="h-14 flex-1 text-lg"
                      style={mode === 'character' ? {
                        borderRadius: 0,
                        background: 'transparent',
                        border: '2px solid #c219a6',
                        color: '#c219a6',
                        textShadow: '0 0 8px #c219a6',
                        boxShadow: '0 0 14px rgba(194,25,166,0.5)',
                      } : mode === 'dykm' ? {
                        borderRadius: 0,
                        background: '#8b0000',
                        border: 'none',
                        color: 'white',
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        fontWeight: 700,
                      } : mode === 'forehead' ? {
                        borderRadius: 0,
                        background: '#ff4fa3',
                        border: 'none',
                        color: 'white',
                        fontFamily: "Arial, 'Helvetica Neue', sans-serif",
                        fontWeight: 900,
                        boxShadow: '0 4px 0 #a8005a, 0 0 16px rgba(255,79,163,0.4)',
                      } : undefined}
                      disabled={createRoomMutation.isPending}
                    >
                      {createRoomMutation.isPending ? t.creating : t.letsGo}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {view === 'join' && (
          <Card
            className="animate-in slide-in-from-left-8 duration-300"
            style={mode === 'character' ? {
              borderRadius: 0,
              border: '2px solid rgba(57,213,255,0.65)',
              background: 'rgba(0,4,18,0.88)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 0 28px rgba(57,213,255,0.2)',
            } : mode === 'dykm' ? {
              borderRadius: 0,
              border: '2px solid #8b0000',
              background: '#fdf6ee',
              boxShadow: '4px 4px 0 rgba(139,0,0,0.4)',
            } : mode === 'forehead' ? {
              borderRadius: 0,
              border: '2px solid #ffe600',
              background: 'rgba(0,0,0,0.9)',
              boxShadow: '0 0 28px rgba(255,230,0,0.15)',
            } : undefined}
          >
            <CardHeader>
              <CardTitle
                className="text-2xl"
                style={mode === 'character' ? { color: '#39d5ff', textShadow: '0 0 10px rgba(57,213,255,0.7)' } : mode === 'dykm' ? { color: '#8b0000', fontFamily: "Georgia, 'Times New Roman', serif" } : mode === 'forehead' ? { color: '#ffe600', fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 900 } : undefined}
              >
                {t.joinRoomTitle}
              </CardTitle>
              <CardDescription style={mode === 'character' ? { color: 'rgba(255,255,255,0.55)' } : mode === 'dykm' ? { color: '#5a0a0a', fontFamily: "Georgia, 'Times New Roman', serif" } : mode === 'forehead' ? { color: 'rgba(255,255,255,0.6)' } : undefined}>
                {t.joinRoomDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...joinForm}>
                <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-6">
                  <FormField
                    control={joinForm.control}
                    name="roomCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel
                          className="text-lg font-bold"
                          style={mode === 'character' ? { color: 'rgba(255,255,255,0.85)' } : mode === 'dykm' ? { color: '#8b0000', fontFamily: "Georgia, 'Times New Roman', serif" } : mode === 'forehead' ? { color: '#ffe600', fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 700 } : undefined}
                        >
                          {t.roomCode}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ABCDE"
                            className="text-2xl h-14 border-2 font-mono text-center uppercase tracking-widest"
                            style={mode === 'character' ? {
                              borderRadius: 0,
                              border: '2px solid rgba(57,213,255,0.5)',
                              background: 'rgba(0,0,0,0.55)',
                              color: '#39d5ff',
                              letterSpacing: '0.25em',
                              boxShadow: '0 0 8px rgba(57,213,255,0.15)',
                            } : mode === 'dykm' ? {
                              borderRadius: 0,
                              border: '2px solid #8b0000',
                              background: '#ffffff',
                              color: '#8b0000',
                              letterSpacing: '0.3em',
                              fontFamily: "Georgia, 'Times New Roman', serif",
                              fontWeight: 900,
                            } : mode === 'forehead' ? {
                              borderRadius: 0,
                              border: '2px solid #ffe600',
                              background: 'rgba(0,0,0,0.8)',
                              color: '#ffe600',
                              letterSpacing: '0.3em',
                              fontFamily: "Arial, 'Helvetica Neue', sans-serif",
                              fontWeight: 900,
                              boxShadow: '0 0 12px rgba(255,230,0,0.3)',
                            } : undefined}
                            maxLength={5}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={joinForm.control}
                    name="playerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel
                          className="text-lg font-bold"
                          style={mode === 'character' ? { color: 'rgba(255,255,255,0.85)' } : mode === 'dykm' ? { color: '#8b0000', fontFamily: "Georgia, 'Times New Roman', serif" } : mode === 'forehead' ? { color: '#ff4fa3', fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 700 } : undefined}
                        >
                          {t.yourName}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t.joinNamePlaceholder}
                            className="text-xl h-14 border-2"
                            style={mode === 'character' ? {
                              borderRadius: 0,
                              border: '2px solid rgba(57,213,255,0.5)',
                              background: 'rgba(0,0,0,0.55)',
                              color: 'white',
                              boxShadow: '0 0 8px rgba(57,213,255,0.15)',
                            } : mode === 'dykm' ? {
                              borderRadius: 0,
                              border: '2px solid #8b0000',
                              background: '#ffffff',
                              color: '#1a0505',
                              fontFamily: "Georgia, 'Times New Roman', serif",
                            } : mode === 'forehead' ? {
                              borderRadius: 0,
                              border: '2px solid #ff4fa3',
                              background: 'rgba(0,0,0,0.8)',
                              color: 'white',
                              fontFamily: "Arial, 'Helvetica Neue', sans-serif",
                              boxShadow: '0 0 8px rgba(255,79,163,0.2)',
                            } : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 px-6"
                      style={mode === 'character' ? {
                        borderRadius: 0,
                        border: '2px solid rgba(255,255,255,0.25)',
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.7)',
                      } : mode === 'dykm' ? {
                        borderRadius: 0,
                        border: '2px solid #8b0000',
                        background: 'transparent',
                        color: '#8b0000',
                      } : mode === 'forehead' ? {
                        borderRadius: 0,
                        border: '2px solid rgba(255,255,255,0.35)',
                        background: 'transparent',
                        color: 'white',
                      } : { borderRadius: '1rem' }}
                      onClick={() => setView('main')}
                    >
                      {t.back}
                    </Button>
                    <Button
                      type="submit"
                      variant="secondary"
                      className="h-14 flex-1 text-lg"
                      style={mode === 'character' ? {
                        borderRadius: 0,
                        background: 'transparent',
                        border: '2px solid #39d5ff',
                        color: '#39d5ff',
                        textShadow: '0 0 8px #39d5ff',
                        boxShadow: '0 0 14px rgba(57,213,255,0.5)',
                      } : mode === 'dykm' ? {
                        borderRadius: 0,
                        background: '#8b0000',
                        border: 'none',
                        color: 'white',
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        fontWeight: 700,
                      } : mode === 'forehead' ? {
                        borderRadius: 0,
                        background: '#ffe600',
                        border: 'none',
                        color: '#000',
                        fontFamily: "Arial, 'Helvetica Neue', sans-serif",
                        fontWeight: 900,
                        boxShadow: '0 4px 0 #a89600, 0 0 16px rgba(255,230,0,0.3)',
                      } : undefined}
                      disabled={joinRoomMutation.isPending}
                    >
                      {joinRoomMutation.isPending ? t.joining : t.joinGame}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

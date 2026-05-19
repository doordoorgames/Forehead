import { useState } from 'react';
import { useLocation } from 'wouter';
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
  const { t, lang } = useLang();
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

  const onCreateSubmit = (values: z.infer<typeof createRoomSchema>) => {
    createRoomMutation.mutate(
      { data: { hostName: values.hostName, mode, lang } as any },
      {
        onSuccess: (data) => {
          const host = data.players.find(p => p.isHost);
          if (host) {
            sessionStorage.setItem(`fg_playerId_${data.code}`, String(host.id));
            sessionStorage.setItem(`fg_playerName_${data.code}`, host.name);
          }
          setLocation(`/room/${data.code}`);
        },
        onError: () => {
          toast({ title: t.errorTitle, description: t.errorCreate, variant: 'destructive' });
        }
      }
    );
  };

  const onJoinSubmit = (values: z.infer<typeof joinRoomSchema>) => {
    joinRoomMutation.mutate(
      { code: values.roomCode, data: { playerName: values.playerName } },
      {
        onSuccess: (data) => {
          sessionStorage.setItem(`fg_playerId_${data.room.code}`, String(data.playerId));
          sessionStorage.setItem(`fg_playerName_${data.room.code}`, data.playerName);
          setLocation(`/room/${data.room.code}`);
        },
        onError: () => {
          toast({ title: t.errorTitle, description: t.errorJoin, variant: 'destructive' });
        }
      }
    );
  };

  const isAr = lang === 'ar';

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
      {/* DYKM mode: warm retro background */}
      {mode === 'dykm' && (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #f5ede0 0%, #e8d5c4 50%, #d4bfb0 100%)' }}>
          {/* VHS scanlines */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
          }} />
          {/* Warm noise overlay */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(92,32,48,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(107,158,159,0.2) 0%, transparent 60%)',
          }} />
        </div>
      )}
      {mode !== 'character' && mode !== 'dykm' && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-3xl" />
        </>
      )}

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {mode === 'forehead' && (
            <h1
              className="neon-word mb-4 rotate-[-2deg] leading-none"
              style={{
                fontSize: 'clamp(52px, 14vw, 110px)',
                fontFamily: isAr ? "'Changa', sans-serif" : undefined,
              }}
            >
              <span className="block">{t.appTitle1}</span>
              <span className="block rotate-[4deg] mt-1" style={{ color: '#c219a6' }}>{t.appTitle2}</span>
            </h1>
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
            <div className="mb-4 flex flex-col items-center gap-1">
              <div style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 'clamp(11px, 2.5vw, 14px)',
                color: '#6b9e9f',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                ▶ REC • MEMORY ARCHIVE
              </div>
              <h1 style={{
                fontFamily: isAr ? "'Changa', sans-serif" : "'Courier New', Courier, monospace",
                fontSize: isAr ? 'clamp(36px, 10vw, 72px)' : 'clamp(26px, 7vw, 52px)',
                fontWeight: 900,
                color: '#5c2030',
                letterSpacing: isAr ? undefined : '0.04em',
                lineHeight: 1.1,
                textShadow: '2px 2px 0 rgba(196,130,122,0.4)',
                direction: isAr ? 'rtl' : undefined,
              }}>
                {t.dykmMode}
              </h1>
              <p style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 'clamp(10px, 2.2vw, 13px)',
                color: '#9e7060',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
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
                    background: 'transparent',
                    border: '2px solid #5c2030',
                    borderRadius: 0,
                    color: '#5c2030',
                    textShadow: '1px 1px 0 rgba(196,130,122,0.5)',
                    boxShadow: '3px 3px 0 #5c2030',
                    fontFamily: "'Courier New', Courier, monospace",
                    letterSpacing: '0.05em',
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
                    border: '2px solid #6b9e9f',
                    borderRadius: 0,
                    color: '#6b9e9f',
                    textShadow: '1px 1px 0 rgba(107,158,159,0.4)',
                    boxShadow: '3px 3px 0 #6b9e9f',
                    fontFamily: "'Courier New', Courier, monospace",
                    letterSpacing: '0.05em',
                    ...(isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 700 } : {}),
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
              </>
            )}

            <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setLocation('/mode')}>
              ← {t.back}
            </Button>
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
            } : undefined}
          >
            <CardHeader>
              <CardTitle
                className="text-2xl"
                style={mode === 'character' ? { color: '#39d5ff', textShadow: '0 0 10px rgba(57,213,255,0.7)' } : undefined}
              >
                {t.createRoomTitle}
              </CardTitle>
              <CardDescription style={mode === 'character' ? { color: 'rgba(255,255,255,0.55)' } : undefined}>
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
                          style={mode === 'character' ? { color: 'rgba(255,255,255,0.85)' } : undefined}
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
            } : undefined}
          >
            <CardHeader>
              <CardTitle
                className="text-2xl"
                style={mode === 'character' ? { color: '#39d5ff', textShadow: '0 0 10px rgba(57,213,255,0.7)' } : undefined}
              >
                {t.joinRoomTitle}
              </CardTitle>
              <CardDescription style={mode === 'character' ? { color: 'rgba(255,255,255,0.55)' } : undefined}>
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
                          style={mode === 'character' ? { color: 'rgba(255,255,255,0.85)' } : undefined}
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
                          style={mode === 'character' ? { color: 'rgba(255,255,255,0.85)' } : undefined}
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

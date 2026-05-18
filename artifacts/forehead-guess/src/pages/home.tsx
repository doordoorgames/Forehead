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
};

export default function Home({ mode }: { mode: 'forehead' | 'character' | 'charades' }) {
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
      {mode !== 'character' && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-3xl" />
        </>
      )}

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {mode === 'forehead' && (
            <h1
              className="neon-word mb-4 rotate-[-2deg] leading-none"
              style={{
                fontSize: 'clamp(52px, 14vw, 110px)',
                fontFamily: isAr ? "'Changa', sans-serif" : undefined,
              }}
            >
              <span className="block">{t.appTitle1}</span>
              <span className="block rotate-[4deg] mt-1" style={{ color: '#ff4fa3' }}>{t.appTitle2}</span>
            </h1>
          )}
          {mode === 'character' && (
            <div className="mb-4 flex flex-col items-center gap-2">
              <img
                src="/character-neon-logo-nobg.png"
                alt="خمّن"
                style={{
                  width: 'clamp(200px, 58vw, 360px)',
                  display: 'block',
                  filter: [
                    'drop-shadow(0 0 6px #ff4fa3)',
                    'drop-shadow(0 0 14px #ff4fa3)',
                    'drop-shadow(0 0 28px rgba(255,79,163,0.7))',
                  ].join(' '),
                }}
              />
              <p
                className="font-black leading-tight"
                style={{
                  fontSize: 'clamp(24px, 6.5vw, 46px)',
                  color: '#ff4fa3',
                  textShadow: '0 0 6px #ff4fa3, 0 0 16px #ff4fa3, 0 0 32px rgba(255,79,163,0.7)',
                  fontFamily: "'Changa', sans-serif",
                  direction: 'rtl',
                }}
              >
                خمّن الشخصية
              </p>
              <p
                className="font-black leading-tight"
                style={{
                  fontSize: 'clamp(15px, 4vw, 26px)',
                  color: '#0f2a5c',
                  textShadow: '0 0 6px #ff4fa3, 0 0 14px #ff4fa3, 0 0 28px rgba(255,79,163,0.8)',
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
          <p className="text-xl font-medium text-muted-foreground mt-4">{t.tagline}</p>
        </div>

        {view === 'main' && (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
            {mode === 'character' ? (
              <>
                <button
                  className="w-full text-xl h-16 font-black text-white tracking-wide transition-transform active:scale-95"
                  style={{
                    background: 'transparent',
                    border: '2px solid #ff4fa3',
                    borderRadius: 0,
                    color: '#ff4fa3',
                    textShadow: '0 0 8px #ff4fa3',
                    boxShadow: '0 0 12px rgba(255,79,163,0.6), inset 0 0 12px rgba(255,79,163,0.08)',
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
                        border: '2px solid #ff4fa3',
                        color: '#ff4fa3',
                        textShadow: '0 0 8px #ff4fa3',
                        boxShadow: '0 0 14px rgba(255,79,163,0.5)',
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

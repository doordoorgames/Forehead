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

export default function Home() {
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
    const mode = localStorage.getItem('fg_mode') || 'forehead';
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
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-3xl" />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          <p className="text-xl font-medium text-muted-foreground mt-4">{t.tagline}</p>
        </div>

        {view === 'main' && (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
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

            <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setLocation('/mode')}>
              ← {t.back}
            </Button>
            <Button variant="ghost" className="mt-2" onClick={() => setLocation('/admin')}>
              {t.adminPanel}
            </Button>
          </div>
        )}

        {view === 'create' && (
          <Card className="border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] rounded-3xl animate-in slide-in-from-right-8 duration-300">
            <CardHeader>
              <CardTitle className="text-2xl">{t.createRoomTitle}</CardTitle>
              <CardDescription>{t.createRoomDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
                  <FormField
                    control={createForm.control}
                    name="hostName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-bold">{t.yourName}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.namePlaceholder} className="text-xl h-14 rounded-2xl border-2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="h-14 rounded-2xl px-6" onClick={() => setView('main')}>
                      {t.back}
                    </Button>
                    <Button type="submit" className="h-14 rounded-2xl flex-1 text-lg shadow-[0_4px_0_0_hsl(var(--primary-border))]" disabled={createRoomMutation.isPending}>
                      {createRoomMutation.isPending ? t.creating : t.letsGo}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {view === 'join' && (
          <Card className="border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] rounded-3xl animate-in slide-in-from-left-8 duration-300">
            <CardHeader>
              <CardTitle className="text-2xl">{t.joinRoomTitle}</CardTitle>
              <CardDescription>{t.joinRoomDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...joinForm}>
                <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-6">
                  <FormField
                    control={joinForm.control}
                    name="roomCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-bold">{t.roomCode}</FormLabel>
                        <FormControl>
                          <Input placeholder="ABCDE" className="text-2xl h-14 rounded-2xl border-2 font-mono text-center uppercase tracking-widest" maxLength={5} {...field} />
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
                        <FormLabel className="text-lg font-bold">{t.yourName}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.joinNamePlaceholder} className="text-xl h-14 rounded-2xl border-2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="h-14 rounded-2xl px-6" onClick={() => setView('main')}>
                      {t.back}
                    </Button>
                    <Button type="submit" variant="secondary" className="h-14 rounded-2xl flex-1 text-lg shadow-[0_4px_0_0_hsl(var(--secondary-border))]" disabled={joinRoomMutation.isPending}>
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

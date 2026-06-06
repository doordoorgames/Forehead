import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetRoom } from '@workspace/api-client-react';
import { fetchForeheadCategories, ForeheadCategory } from '@/lib/supabase-forehead';
import { useGameSocket, RoomState, RoundInfo, RevealInfo } from '@/hooks/useGameSocket';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Check, Users, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import CharacterRoom from './character-room';
import CharadesRoom from './charades-room';
import DykmRoom from './dykm-room';
import RoomJoinQR from '@/components/RoomJoinQR';
import PetalSwoop from '@/components/PetalSwoop';
import grassBg from '@assets/6E21F754-65A0-4119-A739-67DD40CAA6B4_1780250343871.png';

export default function Room() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLang();

  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const storedId = sessionStorage.getItem(`fg_playerId_${code}`);
    const storedName = sessionStorage.getItem(`fg_playerName_${code}`);
    if (!storedId || !storedName) {
      toast({ title: t.notInRoom, description: t.notInRoomDesc });
      setLocation('/home');
      return;
    }
    setPlayerId(Number(storedId));
    setPlayerName(storedName);
  }, [code, setLocation, toast, t]);

  const { data: initialRoom, isLoading: isRoomLoading } = useGetRoom(code || '', {
    query: { enabled: !!code && !!playerId, queryKey: ['getRoom', code] }
  });

  const socket = useGameSocket(code || '', playerId, playerName);

  if (!code || !playerId || !playerName) return null;

  if (isRoomLoading && !socket.roomState) {
    const storedMode = code ? sessionStorage.getItem(`fg_roomMode_${code}`) : null;
    if (storedMode === 'dykm') {
      return (
        <div style={{
          position: 'relative',
          minHeight: '100dvh',
          background: `linear-gradient(rgba(10,28,10,0.22), rgba(10,28,10,0.22)), url(${grassBg}) center/cover no-repeat`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <PetalSwoop immediate />
          <div style={{ textAlign: 'center', fontFamily: "Georgia, 'Times New Roman', serif", color: '#fdf6ee', zIndex: 10, position: 'relative' }}>
            <div style={{ fontSize: 36, marginBottom: 12, letterSpacing: '0.2em' }}>❀</div>
            <div style={{ letterSpacing: '0.4em', fontSize: 12, textTransform: 'uppercase', textShadow: '1px 1px 0 #8b0000' }}>Loading…</div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-primary" />
      </div>
    );
  }

  const roomState = socket.roomState || (initialRoom ? {
    code: initialRoom.code,
    status: initialRoom.status as RoomState['status'],
    mode: (initialRoom.mode ?? 'forehead') as RoomState['mode'],
    categoryId: initialRoom.categoryId ?? null,
    categoryName: null,
    players: initialRoom.players,
  } : null);

  const status = roomState?.status || 'waiting';
  const mode = roomState?.mode ?? 'forehead';

  // Character mode: render dedicated component
  if (mode === 'character') {
    return (
      <CharacterRoom
        code={code}
        playerId={playerId}
        roomState={roomState}
        socket={socket}
        onGoHome={() => setLocation('/home')}
      />
    );
  }

  // Charades mode: render dedicated component
  if (mode === 'charades') {
    return (
      <CharadesRoom
        code={code}
        playerId={playerId}
        roomState={roomState}
        socket={socket}
        onGoHome={() => setLocation('/home')}
      />
    );
  }

  // DYKM mode: render dedicated component
  if (mode === 'dykm') {
    if (!roomState) return null;
    return (
      <DykmRoom
        code={code}
        playerId={playerId}
        roomState={roomState}
        socket={socket}
        onGoHome={() => setLocation('/mode')}
      />
    );
  }

  // Forehead mode
  return (
    <div className="game-container min-h-[100dvh] text-foreground flex flex-col relative" style={{ overflowX: 'hidden', overflowY: 'auto' }}>
      {socket.error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground p-3 text-center font-bold text-lg">
          {socket.error}
        </div>
      )}

      {status === 'waiting' && roomState && (
        <LobbyView
          roomCode={code}
          playerId={playerId}
          roomState={roomState}
          setCategory={socket.setCategory}
          startGame={socket.startGame}
        />
      )}

      {status === 'countdown' && (
        <CountdownView seconds={socket.countdownSeconds} />
      )}

      {status === 'word_display' && roomState && (
        <WordDisplayView
          playerId={playerId}
          roomState={roomState}
          roundInfo={socket.roundInfo}
          onNewWord={socket.newWord}
          onBackToLobby={socket.playAgain}
          onRegenPlayerWord={socket.regenPlayerWord}
        />
      )}

      {status === 'reveal' && roomState && (
        <RevealView
          playerId={playerId}
          roomState={roomState}
          revealInfo={socket.revealInfo}
          readyPlayerIds={socket.readyPlayerIds}
          onPlayerReady={socket.playerReady}
          onNextRound={socket.nextRound}
          onEndGame={socket.endGame}
          onPlayAgain={socket.playAgain}
        />
      )}

      {status === 'finished' && (
        <FinishedView onGoHome={() => setLocation('/home')} />
      )}
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────

function LobbyView({ roomCode, playerId, roomState, setCategory, startGame }: {
  roomCode: string;
  playerId: number;
  roomState: RoomState;
  setCategory: (name: string, id: number) => void;
  startGame: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [categories, setCategories] = useState<ForeheadCategory[]>([]);
  const [catError, setCatError] = useState<string | null>(null);
  const [catLoading, setCatLoading] = useState(true);
  const { t, lang } = useLang();

  useEffect(() => {
    setCatError(null);
    setCatLoading(true);
    fetchForeheadCategories(lang as 'en' | 'ar').then(({ categories: cats, error }) => {
      if (error) setCatError(error);
      setCategories(cats);
      setCatLoading(false);
    });
  }, [lang]);

  const players = roomState.players;
  const isHost = players.find(p => p.id === playerId)?.isHost ?? false;
  const selectedCategoryName = roomState.categoryName;
  const canStart = players.filter(p => p.connected).length >= 2 && !!selectedCategoryName;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-4 landscape:p-3 gap-4 landscape:gap-3 max-w-2xl mx-auto w-full pb-6">
      {/* Room code — compact in landscape */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5 landscape:hidden">{t.roomCodeLabel}</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-5xl font-black tracking-widest text-primary leading-none">{roomCode}</span>
          <button onClick={handleCopy} className="p-2 bg-muted hover:bg-muted/80 transition-colors">
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <RoomJoinQR roomCode={roomCode} mode="forehead" />

      <div className="bg-card border-2 border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-border bg-muted/50">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-bold">{t.players} ({players.filter(p => p.connected).length})</span>
        </div>
        <ul className="divide-y divide-border">
          {players.map(p => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2">
              <span className={`text-base font-bold ${p.id === playerId ? 'text-primary' : ''}`}>
                {p.name} {p.id === playerId && <span className="text-sm font-normal text-muted-foreground">{t.you}</span>}
              </span>
              {p.isHost && (
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 border border-primary/30">
                  {t.host}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="space-y-3">
          <div>
            <p className="font-bold mb-1.5">{t.selectCategory}</p>
            {catError ? (
              <p className="text-sm text-red-400 text-center py-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{catError}</p>
            ) : catLoading ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                {lang === 'ar' ? 'جاري تحميل التصنيفات...' : 'Loading categories…'}
              </p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {lang === 'ar' ? 'لا توجد كلمات في هذا التصنيف' : 'This category has no words yet.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => {
                  const selected = selectedCategoryName === c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.name, c.id)}
                      className="relative flex flex-col items-center justify-center text-center px-3 py-4 font-bold text-white transition-all active:scale-95"
                      style={{
                        background: selected ? '#5b21b6' : '#3b0764',
                        boxShadow: selected
                          ? '0 0 0 3px #a855f7, 0 4px 16px rgba(168,85,247,0.4)'
                          : '0 2px 8px rgba(0,0,0,0.4)',
                      }}
                    >
                      <span className="text-sm font-black leading-tight">{c.name}</span>
                      <span className="text-xs font-medium mt-1 opacity-70">{c.wordCount} {t.words}</span>
                      {selected && (
                        <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-purple-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button
            size="lg"
            className="w-full h-14 text-xl font-black rounded-none"
            disabled={!canStart}
            onClick={startGame}
          >
            {t.startGame}
          </Button>

          {!canStart && (
            <p className="text-center text-muted-foreground text-sm font-medium">
              {players.filter(p => p.connected).length < 2 ? t.need2Players : t.selectCatFirst}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-lg font-bold">{t.waitingForHost}</p>
          {roomState.categoryName && (
            <p className="text-muted-foreground text-sm">{t.categoryLabel}: <span className="font-bold text-foreground">{roomState.categoryName}</span></p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── COUNTDOWN ────────────────────────────────────────────────────────────────

function CountdownView({ seconds }: { seconds: number }) {
  const { t } = useLang();
  return (
    <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <p className="text-2xl md:text-3xl font-bold text-white/60 mb-4 tracking-wide text-center px-8">
        {t.getReady}
      </p>
      <div
        className="neon-word leading-none tabular-nums"
        style={{ fontSize: 'clamp(100px, 30vw, 260px)' }}
      >
        {seconds > 0 ? seconds : '!'}
      </div>
      <p className="text-xl text-muted-foreground mt-4 font-medium">{t.holdTight}</p>
    </div>
  );
}

// ─── WORD DISPLAY ─────────────────────────────────────────────────────────────

function WordDisplayView({ playerId, roomState, roundInfo, onNewWord, onBackToLobby, onRegenPlayerWord }: {
  playerId: number;
  roomState: RoomState;
  roundInfo: RoundInfo | null;
  onNewWord: () => void;
  onBackToLobby: () => void;
  onRegenPlayerWord: (targetPlayerId: number) => void;
}) {
  const { t } = useLang();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const isHost = roomState.players.find(p => p.id === playerId)?.isHost ?? false;
  const allWords = roundInfo?.allPlayerWords ?? [];

  const handleRowTap = (id: number) => {
    if (!isHost) return;
    setSelectedPlayerId(prev => prev === id ? null : id);
  };

  const handleRegen = (id: number) => {
    onRegenPlayerWord(id);
    setSelectedPlayerId(null);
  };

  return (
    <div className="flex-1 flex flex-col select-none min-h-[100dvh]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Category */}
      {roundInfo?.categoryName && (
        <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground pt-4 pb-1 px-4">
          {roundInfo.categoryName}
        </p>
      )}

      {/* Your word */}
      <div className="text-center pt-3 pb-4 px-4">
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.yourWord}</p>
        <div className="neon-word leading-none" style={{ fontSize: 'clamp(72px, 22vw, 130px)' }}>???</div>
      </div>

      {/* Admin hint */}
      {isHost && (
        <p className="text-center text-xs text-muted-foreground pb-2 px-4">{t.tapPlayerHint}</p>
      )}

      {/* All players list */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-2"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="border-2 border-border overflow-hidden">
          {allWords.length === 0 ? (
            <div className="px-4 py-3 text-center text-muted-foreground text-sm">...</div>
          ) : (
            allWords.map((pw, idx) => {
              const isMe = pw.playerId === playerId;
              const isExpanded = selectedPlayerId === pw.playerId;
              return (
                <div key={pw.playerId}>
                  <button
                    type="button"
                    onClick={() => handleRowTap(pw.playerId)}
                    className={[
                      'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                      idx > 0 ? 'border-t border-border' : '',
                      isExpanded ? 'bg-purple-950/60' : isMe ? 'bg-primary/5' : 'active:bg-muted/30',
                    ].join(' ')}
                  >
                    <span className={`font-bold text-base ${isMe ? 'text-primary' : ''}`}>
                      {pw.playerName}
                      {isMe && <span className="text-xs font-normal text-muted-foreground ml-1">{t.you}</span>}
                    </span>
                    <span className={`text-lg font-black ${pw.word === '???' ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                      {pw.word}
                    </span>
                  </button>
                  {isExpanded && isHost && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-purple-900/40 border-t border-purple-700/50">
                      <span className="text-sm text-purple-200 font-medium">{pw.playerName}</span>
                      <button
                        type="button"
                        onClick={() => handleRegen(pw.playerId)}
                        className="text-sm font-black text-white px-4 py-2 transition-colors active:opacity-80"
                        style={{ background: '#7c3aed' }}
                      >
                        {t.generateNewWord}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Host controls */}
      {isHost && (
        <div className="px-4 pt-3 pb-4 flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-13 font-bold rounded-none border-2 text-base"
            onClick={onBackToLobby}
          >
            {t.backToLobby}
          </Button>
          <Button
            size="lg"
            className="flex-1 h-13 font-black rounded-none text-base"
            onClick={onNewWord}
          >
            {t.getAnotherWord}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── REVEAL ───────────────────────────────────────────────────────────────────

function RevealView({ playerId, roomState, revealInfo, readyPlayerIds, onPlayerReady, onNextRound, onEndGame, onPlayAgain }: {
  playerId: number;
  roomState: RoomState;
  revealInfo: RevealInfo | null;
  readyPlayerIds: number[];
  onPlayerReady: () => void;
  onNextRound: () => void;
  onEndGame: () => void;
  onPlayAgain: () => void;
}) {
  const { t } = useLang();
  const isHost = roomState.players.find(p => p.id === playerId)?.isHost ?? false;
  const connectedPlayers = roomState.players.filter(p => p.connected);

  if (!revealInfo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const allReady = connectedPlayers.every(p => readyPlayerIds.includes(p.id));

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 landscape-safe">
      <div className="text-center">
        <p className="text-base font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.yourWordWas}</p>
        <div
          className="neon-word leading-none"
          style={{ fontSize: 'clamp(44px, 9vw, 110px)' }}
        >
          {revealInfo.myWord}
        </div>
      </div>

      <p className="text-base text-muted-foreground font-medium">
        {readyPlayerIds.length} / {connectedPlayers.length} {t.playersReady}
      </p>

      {!isHost && (
        <Button
          size="lg"
          className="w-full max-w-sm h-14 text-xl font-black rounded-none"
          disabled={readyPlayerIds.includes(playerId)}
          onClick={onPlayerReady}
        >
          {readyPlayerIds.includes(playerId) ? t.alreadyReady : t.readyNextRound}
        </Button>
      )}

      {isHost && (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Button
            size="lg"
            className="w-full h-14 text-xl font-black rounded-none"
            style={{ background: '#2563eb', color: '#fff' }}
            onClick={onPlayAgain}
          >
            {t.lobbyNewWord}
          </Button>
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 h-12 text-base font-bold rounded-none border-2"
              onClick={onEndGame}
            >
              {t.endGame}
            </Button>
            <Button
              size="lg"
              className="flex-1 h-12 text-base font-black rounded-none"
              disabled={!allReady}
              onClick={onNextRound}
            >
              {allReady
                ? t.nextRound
                : `${t.waitingShort} (${readyPlayerIds.length}/${connectedPlayers.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FINISHED ─────────────────────────────────────────────────────────────────

function FinishedView({ onGoHome }: { onGoHome: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    const timer = setTimeout(onGoHome, 4000);
    return () => clearTimeout(timer);
  }, [onGoHome]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div
        className="neon-word leading-none"
        style={{ fontSize: 'clamp(48px, 10vw, 96px)' }}
      >
        {t.gameOver}
      </div>
      <p className="text-xl text-muted-foreground">{t.returningHome}</p>
      <Button size="lg" className="h-14 px-10 text-xl font-bold rounded-none" onClick={onGoHome}>
        {t.goHome}
      </Button>
    </div>
  );
}

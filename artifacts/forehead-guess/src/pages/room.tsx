import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetRoom, useListCategories } from '@workspace/api-client-react';
import { useGameSocket, RoomState, RoundInfo, RevealInfo } from '@/hooks/useGameSocket';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Check, Users } from 'lucide-react';

export default function Room() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const storedId = sessionStorage.getItem(`fg_playerId_${code}`);
    const storedName = sessionStorage.getItem(`fg_playerName_${code}`);
    if (!storedId || !storedName) {
      toast({ title: 'Not in room', description: 'Please join the room first.' });
      setLocation('/');
      return;
    }
    setPlayerId(Number(storedId));
    setPlayerName(storedName);
  }, [code, setLocation, toast]);

  const { data: initialRoom, isLoading: isRoomLoading } = useGetRoom(code || '', {
    query: { enabled: !!code && !!playerId, queryKey: ['getRoom', code] }
  });

  const socket = useGameSocket(code || '', playerId, playerName);

  if (!code || !playerId || !playerName) return null;

  if (isRoomLoading && !socket.roomState) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-primary" />
      </div>
    );
  }

  const roomState = socket.roomState || (initialRoom ? {
    code: initialRoom.code,
    status: initialRoom.status as RoomState['status'],
    categoryId: initialRoom.categoryId ?? null,
    categoryName: null,
    players: initialRoom.players,
  } : null);

  const status = roomState?.status || 'waiting';

  return (
    <>
      {/* Force landscape hint overlay */}
      <div className="portrait-warning fixed inset-0 z-[9999] bg-black flex-col items-center justify-center hidden">
        <img
          src={`${import.meta.env.BASE_URL}rotate-phone.png`}
          alt="Rotate your phone to landscape"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

      <div className="game-container min-h-[100dvh] text-foreground flex flex-col relative overflow-hidden">
        {/* Error toast */}
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
            onEndRound={socket.endRound}
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
          <FinishedView onGoHome={() => setLocation('/')} />
        )}
      </div>
    </>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────

function LobbyView({ roomCode, playerId, roomState, setCategory, startGame }: {
  roomCode: string;
  playerId: number;
  roomState: RoomState;
  setCategory: (id: number) => void;
  startGame: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { data: categories } = useListCategories();
  const players = roomState.players;
  const isHost = players.find(p => p.id === playerId)?.isHost ?? false;
  const currentCategoryId = roomState.categoryId;
  const canStart = players.filter(p => p.connected).length >= 2 && !!currentCategoryId;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 max-w-2xl mx-auto w-full">
      {/* Room code */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Room Code</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-6xl font-black tracking-widest text-primary">{roomCode}</span>
          <button onClick={handleCopy} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
            {copied ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="bg-card border-2 border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-border bg-muted/50">
          <Users className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg">Players ({players.filter(p => p.connected).length})</span>
        </div>
        <ul className="divide-y divide-border">
          {players.map(p => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className={`text-xl font-bold ${p.id === playerId ? 'text-primary' : ''}`}>
                {p.name} {p.id === playerId && <span className="text-base font-normal text-muted-foreground">(you)</span>}
              </span>
              {p.isHost && (
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/30">
                  HOST
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Host controls or waiting */}
      {isHost ? (
        <div className="space-y-4">
          <div>
            <p className="font-bold text-lg mb-2">Select Category</p>
            <Select
              value={currentCategoryId ? String(currentCategoryId) : undefined}
              onValueChange={(val) => setCategory(Number(val))}
            >
              <SelectTrigger className="h-14 text-lg rounded-xl border-2">
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)} className="text-lg">
                    {c.name} · {c.itemCount} words
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-2xl font-black rounded-2xl"
            disabled={!canStart}
            onClick={startGame}
          >
            Start Game
          </Button>

          {!canStart && (
            <p className="text-center text-muted-foreground font-medium">
              {players.filter(p => p.connected).length < 2
                ? 'Need at least 2 players'
                : 'Select a category to start'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xl font-bold">Waiting for host to start...</p>
          {roomState.categoryName && (
            <p className="text-muted-foreground">Category: <span className="font-bold text-foreground">{roomState.categoryName}</span></p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── COUNTDOWN ────────────────────────────────────────────────────────────────

function CountdownView({ seconds }: { seconds: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center landscape-safe">
      <p className="text-2xl md:text-3xl font-bold text-white/60 mb-4 tracking-wide text-center px-8">
        Get ready — place phone on forehead
      </p>
      <div
        className="neon-word leading-none tabular-nums"
        style={{ fontSize: 'clamp(100px, 22vw, 260px)' }}
      >
        {seconds > 0 ? seconds : '!'}
      </div>
      <p className="text-xl text-muted-foreground mt-4 font-medium">Hold on tight!</p>
    </div>
  );
}

// ─── WORD DISPLAY ─────────────────────────────────────────────────────────────

function WordDisplayView({ playerId, roomState, roundInfo, onEndRound }: {
  playerId: number;
  roomState: RoomState;
  roundInfo: RoundInfo | null;
  onEndRound: () => void;
}) {
  const isHost = roomState.players.find(p => p.id === playerId)?.isHost ?? false;
  const word = roundInfo?.myWord ?? '...';

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative landscape-safe select-none">
      {/* Category label */}
      {roundInfo?.categoryName && (
        <p className="absolute top-4 left-0 right-0 text-center text-base font-bold uppercase tracking-widest text-muted-foreground">
          {roundInfo.categoryName}
        </p>
      )}

      {/* THE WORD — huge, designed for forehead mode */}
      <div
        className="neon-word text-center leading-none px-6 break-words"
        style={{ fontSize: 'clamp(64px, 14vw, 180px)', maxWidth: '90vw' }}
      >
        {word}
      </div>

      {/* Admin-only End Round button, kept subtle at top-right */}
      {isHost && (
        <div className="absolute bottom-8 right-8">
          <Button
            size="lg"
            variant="outline"
            className="text-lg font-bold h-14 px-8 rounded-2xl border-2"
            onClick={onEndRound}
          >
            Show Reveal →
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
  const isHost = roomState.players.find(p => p.id === playerId)?.isHost ?? false;
  const connectedPlayers = roomState.players.filter(p => p.connected);

  if (!revealInfo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 landscape-safe">
      {/* Word reveal */}
      <div className="text-center">
        <p className="text-base font-bold uppercase tracking-widest text-muted-foreground mb-1">Your word was</p>
        <div
          className="neon-word leading-none"
          style={{ fontSize: 'clamp(44px, 9vw, 110px)' }}
        >
          {revealInfo.myWord}
        </div>
      </div>

      {/* Ready counter */}
      <p className="text-base text-muted-foreground font-medium">
        {readyPlayerIds.length} / {connectedPlayers.length} players ready
      </p>

      {/* Non-host: ready button */}
      {!isHost && (
        <Button
          size="lg"
          className="w-full max-w-sm h-14 text-xl font-black rounded-2xl"
          disabled={readyPlayerIds.includes(playerId)}
          onClick={onPlayerReady}
        >
          {readyPlayerIds.includes(playerId) ? '✓ Ready!' : 'Ready for next round'}
        </Button>
      )}

      {/* Host actions */}
      {isHost && (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Button
            size="lg"
            className="w-full h-14 text-xl font-black rounded-2xl"
            style={{ background: '#2563eb', color: '#fff' }}
            onClick={onPlayAgain}
          >
            Lobby for a new word
          </Button>
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 h-12 text-base font-bold rounded-2xl border-2"
              onClick={onEndGame}
            >
              End Game
            </Button>
            <Button
              size="lg"
              className="flex-1 h-12 text-base font-black rounded-2xl"
              disabled={!connectedPlayers.every(p => readyPlayerIds.includes(p.id))}
              onClick={onNextRound}
            >
              {connectedPlayers.every(p => readyPlayerIds.includes(p.id))
                ? 'Next Round →'
                : `Waiting (${readyPlayerIds.length}/${connectedPlayers.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FINISHED ─────────────────────────────────────────────────────────────────

function FinishedView({ onGoHome }: { onGoHome: () => void }) {
  useEffect(() => {
    const t = setTimeout(onGoHome, 4000);
    return () => clearTimeout(t);
  }, [onGoHome]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div style={{ fontSize: 'clamp(48px, 10vw, 96px)' }} className="font-black">
        Game Over!
      </div>
      <p className="text-xl text-muted-foreground">Returning to home...</p>
      <Button size="lg" className="h-14 px-10 text-xl font-bold rounded-2xl" onClick={onGoHome}>
        Go Home
      </Button>
    </div>
  );
}

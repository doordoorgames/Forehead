import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check, Users } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import CharadesBackground from '@/components/CharadesBackground';
import type { RoomState } from '@/hooks/useGameSocket';

// ─── PURPLE/GOLD THEME ────────────────────────────────────────────────────────
const PURPLE = '#a855f7';
const DEEP_PURPLE = '#7c3aed';
const GOLD = '#ffd000';
const AMBER = '#f59e0b';

const purpleGlow = { boxShadow: `0 0 32px ${PURPLE}60, 0 0 8px ${PURPLE}40` };
const goldGlow   = { boxShadow: `0 0 32px ${GOLD}60, 0 0 8px ${GOLD}40` };

interface CharadesRoomProps {
  code: string;
  playerId: number;
  roomState: RoomState | null;
  socket: {
    roomState: RoomState | null;
    charadesState: any;
    error: string | null;
    charadesStart: () => void;
    charadesNext: () => void;
    charadesEndGame: () => void;
    charadesBackToLobby: () => void;
  };
  onGoHome: () => void;
}

export default function CharadesRoom({ code, playerId, roomState, socket, onGoHome }: CharadesRoomProps) {
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const fontStyle = isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 800 } : {};

  const status = roomState?.status ?? 'waiting';

  return (
    <div
      className="min-h-[100dvh] text-white flex flex-col relative overflow-hidden"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Painting-themed canvas background */}
      <CharadesBackground />

      {/* Error banner */}
      {socket.error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#a855f7] text-white p-3 text-center font-bold text-lg">
          {socket.error}
        </div>
      )}

      {status === 'waiting' && roomState && (
        <CharadesLobbyView
          roomCode={code}
          playerId={playerId}
          roomState={roomState}
          onStart={socket.charadesStart}
          t={t}
          fontStyle={fontStyle}
        />
      )}

      {status === 'charades_playing' && (
        <CharadesGameView
          playerId={playerId}
          roomState={roomState}
          charadesState={socket.charadesState}
          onNext={socket.charadesNext}
          onEndGame={socket.charadesEndGame}
          onBackToLobby={socket.charadesBackToLobby}
          t={t}
          fontStyle={fontStyle}
        />
      )}

      {status === 'finished' && (
        <CharadesFinishedView onGoHome={onGoHome} t={t} fontStyle={fontStyle} />
      )}
    </div>
  );
}

// ─── LOBBY VIEW ───────────────────────────────────────────────────────────────

function CharadesLobbyView({
  roomCode, playerId, roomState, onStart, t, fontStyle,
}: {
  roomCode: string;
  playerId: number;
  roomState: RoomState;
  onStart: () => void;
  t: any;
  fontStyle: object;
}) {
  const [copied, setCopied] = useState(false);
  const players = roomState.players;
  const isHost = players.find(p => p.id === playerId)?.isHost ?? false;
  const connected = players.filter(p => p.connected);
  const canStart = connected.length >= 2;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-lg mx-auto w-full">
      {/* Mode badge */}
      <span
        className="px-4 py-1.5 rounded-full text-sm font-bold border-2 text-[#ffd000] bg-[#ffd000]/10"
        style={{ borderColor: GOLD, ...fontStyle }}
      >
        🎭 {t.charadesLobbyTitle}
      </span>

      {/* Room code */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1" style={fontStyle}>
          {t.roomCodeLabel}
        </p>
        <div className="flex items-center justify-center gap-3">
          <span
            className="text-5xl font-black tracking-widest leading-none"
            style={{ color: GOLD, textShadow: `0 0 20px ${GOLD}80` }}
          >
            {roomCode}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-white/70" />}
          </button>
        </div>
      </div>

      {/* Players list */}
      <div
        className="w-full rounded-2xl border-2 overflow-hidden"
        style={{ borderColor: `${PURPLE}60`, background: 'rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: `${PURPLE}40`, background: `${PURPLE}15` }}>
          <Users className="w-4 h-4" style={{ color: PURPLE }} />
          <span className="font-bold text-sm" style={{ color: PURPLE, ...fontStyle }}>
            {t.players} ({connected.length})
          </span>
        </div>
        <ul className="divide-y" style={{ borderColor: `${PURPLE}20` }}>
          {players.map(p => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <span
                className="font-bold text-base"
                style={p.id === playerId ? { color: GOLD } : { color: 'rgba(255,255,255,0.85)' }}
              >
                {p.name}
                {p.id === playerId && (
                  <span className="text-xs font-normal text-white/40 ml-2" style={fontStyle}>{t.you}</span>
                )}
              </span>
              {p.isHost && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full border"
                  style={{ color: GOLD, borderColor: `${GOLD}60`, background: `${GOLD}15` }}
                >
                  {t.host}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Start / Waiting */}
      {isHost ? (
        <div className="w-full space-y-3">
          <Button
            size="lg"
            className="w-full h-14 text-xl font-black rounded-2xl border-2 text-black"
            style={{
              background: canStart ? `linear-gradient(135deg, ${PURPLE}, ${DEEP_PURPLE})` : undefined,
              borderColor: PURPLE,
              color: 'white',
              ...purpleGlow,
              ...fontStyle,
            }}
            disabled={!canStart}
            onClick={onStart}
          >
            {t.charadesStartGame}
          </Button>
          {!canStart && (
            <p className="text-center text-white/50 text-sm" style={fontStyle}>
              {t.charadesNeedPlayers}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: PURPLE }} />
          <p className="font-bold text-white/70" style={fontStyle}>{t.charadesWaitingToStart}</p>
        </div>
      )}
    </div>
  );
}

// ─── GAME VIEW ────────────────────────────────────────────────────────────────

function CharadesGameView({
  playerId, roomState, charadesState, onNext, onEndGame, onBackToLobby, t, fontStyle,
}: {
  playerId: number;
  roomState: RoomState | null;
  charadesState: any;
  onNext: () => void;
  onEndGame: () => void;
  onBackToLobby: () => void;
  t: any;
  fontStyle: object;
}) {
  if (!charadesState) {
    return (
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin" style={{ color: PURPLE }} />
      </div>
    );
  }

  const { isHost, isPerformer, performerName, nextPerformerName, word, wordNumber, totalWords } = charadesState;

  if (isPerformer) {
    return <PerformerView word={word} wordNumber={wordNumber} totalWords={totalWords} t={t} fontStyle={fontStyle} />;
  }

  if (isHost) {
    return (
      <HostGameView
        word={word}
        performerName={performerName}
        nextPerformerName={nextPerformerName}
        wordNumber={wordNumber}
        totalWords={totalWords}
        onNext={onNext}
        onEndGame={onEndGame}
        onBackToLobby={onBackToLobby}
        t={t}
        fontStyle={fontStyle}
      />
    );
  }

  return <SpectatorView performerName={performerName} wordNumber={wordNumber} totalWords={totalWords} t={t} fontStyle={fontStyle} />;
}

// ─── PERFORMER VIEW ───────────────────────────────────────────────────────────

function PerformerView({ word, wordNumber, totalWords, t, fontStyle }: {
  word?: string; wordNumber: number; totalWords: number; t: any; fontStyle: object;
}) {
  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center select-none">
      {/* Word counter */}
      <span
        className="px-4 py-1.5 rounded-full text-xs font-bold border"
        style={{ borderColor: `${GOLD}60`, color: GOLD, background: `${GOLD}12` }}
      >
        {t.charadesWordNumber} {wordNumber}
      </span>

      {/* Your turn label */}
      <div>
        <p
          className="text-3xl font-black mb-2"
          style={{ color: PURPLE, textShadow: `0 0 30px ${PURPLE}`, ...fontStyle }}
        >
          {t.charadesYourTurn}
        </p>
        <p className="text-white/60 text-base" style={fontStyle}>{t.charadesPerformWord}</p>
      </div>

      {/* The word — HUGE */}
      <div
        className="font-black text-center leading-tight px-4 break-words"
        style={{
          fontSize: 'clamp(52px, 13vw, 140px)',
          color: GOLD,
          textShadow: `0 0 40px ${GOLD}80, 0 0 80px ${GOLD}40`,
          maxWidth: '90vw',
          fontFamily: fontStyle && (fontStyle as any).fontFamily || undefined,
        }}
      >
        {word ?? '...'}
      </div>

      {/* Painting frame accent */}
      <div
        className="absolute inset-8 rounded-3xl border-2 pointer-events-none"
        style={{ borderColor: `${GOLD}20`, boxShadow: `inset 0 0 40px ${PURPLE}15` }}
      />
    </div>
  );
}

// ─── HOST GAME VIEW ───────────────────────────────────────────────────────────

function HostGameView({
  word, performerName, nextPerformerName, wordNumber, totalWords,
  onNext, onEndGame, onBackToLobby, t, fontStyle,
}: {
  word?: string; performerName: string; nextPerformerName: string;
  wordNumber: number; totalWords: number;
  onNext: () => void; onEndGame: () => void; onBackToLobby: () => void;
  t: any; fontStyle: object;
}) {
  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto w-full text-center">
      {/* Host badge */}
      <span
        className="px-4 py-1.5 rounded-full text-xs font-bold border"
        style={{ borderColor: `${AMBER}60`, color: AMBER, background: `${AMBER}12` }}
      >
        👑 {t.charadesAdminLabel}
      </span>

      {/* Performing now */}
      <div
        className="w-full rounded-2xl p-4 border-2"
        style={{ borderColor: `${PURPLE}50`, background: 'rgba(0,0,0,0.5)' }}
      >
        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1" style={fontStyle}>
          {t.charadesCurrentPerformer}
        </p>
        <p className="text-2xl font-black" style={{ color: PURPLE, ...fontStyle }}>
          {performerName}
        </p>
      </div>

      {/* Current word */}
      <div
        className="w-full rounded-2xl p-5 border-2"
        style={{ borderColor: `${GOLD}60`, background: `${GOLD}08`, ...goldGlow }}
      >
        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-2" style={fontStyle}>
          {t.charadesCurrentWord} · {t.charadesWordNumber} {wordNumber}
        </p>
        <p
          className="font-black leading-tight break-words"
          style={{
            fontSize: 'clamp(32px, 8vw, 72px)',
            color: GOLD,
            textShadow: `0 0 30px ${GOLD}80`,
          }}
        >
          {word ?? '...'}
        </p>
      </div>

      {/* Up next */}
      {nextPerformerName && nextPerformerName !== performerName && (
        <p className="text-sm text-white/40" style={fontStyle}>
          {t.charadesUpNext}: <span className="text-white/70 font-bold">{nextPerformerName}</span>
        </p>
      )}

      {/* Controls */}
      <div className="w-full space-y-3">
        <Button
          size="lg"
          className="w-full h-14 text-lg font-black rounded-2xl border-2 text-white"
          style={{
            background: `linear-gradient(135deg, ${PURPLE}, ${DEEP_PURPLE})`,
            borderColor: PURPLE,
            ...purpleGlow,
            ...fontStyle,
          }}
          onClick={onNext}
        >
          {t.charadesNext}
        </Button>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-11 font-bold rounded-xl border-2 text-white/70 hover:text-white bg-white/5 hover:bg-white/10"
            style={{ borderColor: 'rgba(255,255,255,0.15)', ...fontStyle }}
            onClick={onBackToLobby}
          >
            {t.backToLobby}
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-11 font-bold rounded-xl border-2 hover:text-white"
            style={{ borderColor: '#ef4444', color: '#f87171', background: 'rgba(239,68,68,0.1)', ...fontStyle }}
            onClick={onEndGame}
          >
            {t.charadesEndGame}
          </Button>
        </div>
      </div>

      <p className="text-xs text-white/30 text-center" style={fontStyle}>
        {t.charadesHostInstructions}
      </p>
    </div>
  );
}

// ─── SPECTATOR VIEW ───────────────────────────────────────────────────────────

function SpectatorView({ performerName, wordNumber, totalWords, t, fontStyle }: {
  performerName: string; wordNumber: number; totalWords: number; t: any; fontStyle: object;
}) {
  const watchingTitle = (t.charadesWatchingTitle as string).replace('{name}', performerName);

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center gap-6">
      {/* Word counter */}
      <span
        className="px-4 py-1.5 rounded-full text-xs font-bold border"
        style={{ borderColor: `${GOLD}60`, color: GOLD, background: `${GOLD}12` }}
      >
        {t.charadesWordNumber} {wordNumber}
      </span>

      {/* Big emoji */}
      <div className="text-8xl" style={{ filter: `drop-shadow(0 0 20px ${PURPLE})` }}>
        🎭
      </div>

      {/* Performer name */}
      <div>
        <p
          className="font-black leading-tight"
          style={{
            fontSize: 'clamp(28px, 8vw, 64px)',
            color: PURPLE,
            textShadow: `0 0 30px ${PURPLE}`,
          }}
        >
          {watchingTitle}
        </p>
        <p className="text-white/50 text-base mt-2" style={fontStyle}>
          {t.charadesWatchingDesc}
        </p>
      </div>

      {/* Decorative frame */}
      <div
        className="absolute inset-8 rounded-3xl border pointer-events-none"
        style={{ borderColor: `${PURPLE}20` }}
      />
    </div>
  );
}

// ─── FINISHED VIEW ────────────────────────────────────────────────────────────

function CharadesFinishedView({ onGoHome, t, fontStyle }: { onGoHome: () => void; t: any; fontStyle: object }) {
  useEffect(() => {
    const timer = setTimeout(onGoHome, 4000);
    return () => clearTimeout(timer);
  }, [onGoHome]);

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-8xl">🏆</div>
      <h1
        className="font-black"
        style={{
          fontSize: 'clamp(40px, 10vw, 80px)',
          color: GOLD,
          textShadow: `0 0 40px ${GOLD}80`,
        }}
      >
        {t.gameOver}
      </h1>
      <Button
        size="lg"
        className="h-14 px-10 text-xl font-black rounded-2xl border-2 text-white"
        style={{
          background: `linear-gradient(135deg, ${PURPLE}, ${DEEP_PURPLE})`,
          borderColor: PURPLE,
          ...purpleGlow,
          ...fontStyle,
        }}
        onClick={onGoHome}
      >
        {t.goHome}
      </Button>
    </div>
  );
}

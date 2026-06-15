import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Copy, Check } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';
import bgBigRect from '@assets/398199A7-F3AA-42BA-9585-D50E4BFBCD6C_1781444797139.png';
import bgClean from '@assets/5A7DC98A-72C4-4B1B-993C-37EE3278D61C_1781444797139.png';
import type { RoomState } from '@/hooks/useGameSocket';
import RoomJoinQR from '@/components/RoomJoinQR';

// ─── CHARADES COLOR PALETTE ───────────────────────────────────────────────────
const ORANGE = '#d4540a';      // burnt orange
const PINK   = '#e84d7a';      // warm pink
const RED    = '#e84d7a';      // alias for time-sensitive states → warm pink

// Sharp white text shadow — no blur, no glow
const SHARP = '1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff';

const TURN_DURATION = 60;

// ─── HOURGLASS TIMER ──────────────────────────────────────────────────────────

function HourglassTimer({ seconds, total = TURN_DURATION }: { seconds: number; total?: number }) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const progress = seconds / total;
  const dashOffset = circ * (1 - progress);

  const arcColor = seconds > 20 ? ORANGE : seconds > 10 ? ORANGE : RED;
  const isUrgent = seconds <= 10;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{ width: 110, height: 110 }}
      >
        <svg
          width="110"
          height="110"
          viewBox="0 0 100 100"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.12)"
            strokeWidth="9"
          />
          {/* Progress arc */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={arcColor}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${dashOffset}`}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
          />
        </svg>

        {/* Center — black number, white shadow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-4xl font-black tabular-nums leading-none"
            style={{ color: '#000', textShadow: SHARP }}
          >
            {seconds}
          </span>
        </div>
      </div>

      {/* Urgency pulse text */}
      {isUrgent && seconds > 0 && (
        <span
          className="text-xs font-black tracking-widest uppercase"
          style={{
            color: '#000',
            textShadow: SHARP,
            animation: 'urgency-pulse 0.5s ease-in-out infinite alternate',
          }}
        >
          Hurry!
        </span>
      )}

      <style>{`
        @keyframes hourglass-flip {
          0%   { transform: rotate(0deg); }
          50%  { transform: rotate(180deg); }
          100% { transform: rotate(180deg); }
        }
        @keyframes urgency-pulse {
          from { opacity: 0.5; transform: scale(0.95); }
          to   { opacity: 1;   transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

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

  const bgImage = status === 'charades_playing' ? bgBigRect : bgClean;

  return (
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden"
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >

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
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-5 max-w-lg mx-auto w-full">
      {/* Title */}
      <p
        className="text-lg font-black uppercase tracking-widest"
        style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
      >
        {t.charadesLobbyTitle}
      </p>

      {/* Room code */}
      <div className="text-center">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-1"
          style={{ color: '#000', textShadow: SHARP }}
        >
          {t.roomCodeLabel}
        </p>
        <div className="flex items-center justify-center gap-3">
          <span
            className="text-5xl font-black tracking-widest leading-none"
            style={{ color: '#000', textShadow: SHARP }}
          >
            {roomCode}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
          >
            {copied ? <Check className="w-5 h-5 text-black" /> : <Copy className="w-5 h-5 text-black/60" />}
          </button>
        </div>
      </div>

      <RoomJoinQR roomCode={roomCode} mode="charades" />

      {/* Players list — transparent */}
      <div className="w-full">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-2 text-center"
          style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
        >
          {t.players} ({connected.length})
        </p>
        <ul className="flex flex-col gap-1">
          {players.map(p => (
            <li key={p.id} className="flex items-center justify-between px-3 py-1.5">
              <span
                className="font-bold text-base"
                style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
              >
                {p.name}
                {p.id === playerId && (
                  <span
                    className="text-xs font-normal ml-2"
                    style={{ color: 'rgba(0,0,0,0.45)', textShadow: 'none' }}
                  >
                    {t.you}
                  </span>
                )}
              </span>
              {p.isHost && (
                <span
                  className="text-xs font-bold"
                  style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
                >
                  {t.host}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="w-full space-y-3">
          <button
            className="w-full h-14 text-xl font-black transition-opacity"
            style={{
              background: canStart ? `linear-gradient(135deg, ${ORANGE}, ${PINK})` : 'rgba(0,0,0,0.12)',
              border: `2px solid ${canStart ? ORANGE : 'rgba(0,0,0,0.2)'}`,
              borderRadius: 12,
              color: '#000',
              textShadow: SHARP,
              opacity: canStart ? 1 : 0.5,
              cursor: canStart ? 'pointer' : 'not-allowed',
              ...fontStyle,
            }}
            disabled={!canStart}
            onClick={onStart}
          >
            {t.charadesStartGame}
          </button>
          {!canStart && (
            <p
              className="text-center text-sm"
              style={{ color: 'rgba(0,0,0,0.55)', textShadow: SHARP, ...fontStyle }}
            >
              {t.charadesNeedPlayers}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#000' }} />
          <p
            className="font-bold"
            style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
          >
            {t.charadesWaitingToStart}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── GAME VIEW (timer logic lives here) ───────────────────────────────────────

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
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [timesUp, setTimesUp] = useState(false);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  // Build a stable key that identifies the current turn
  const turnKey = charadesState
    ? `${charadesState.performerName}-${charadesState.wordNumber}`
    : null;

  // Reset timer whenever turn changes
  useEffect(() => {
    if (!turnKey) return;
    setTimeLeft(TURN_DURATION);
    setTimesUp(false);
  }, [turnKey]);

  // Countdown tick
  useEffect(() => {
    if (!turnKey || timesUp) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimesUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [turnKey, timesUp]);

  // When time's up AND this client is host → auto-advance
  useEffect(() => {
    if (!timesUp || !charadesState?.isHost) return;
    const timeout = setTimeout(() => {
      onNextRef.current();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [timesUp, charadesState?.isHost]);

  if (!charadesState) {
    return (
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin" style={{ color: ORANGE }} />
      </div>
    );
  }

  const { isHost, isPerformer, performerName, nextPerformerName, word, wordNumber, totalWords } = charadesState;

  // Host always gets End Turn — check isHost first.
  // When host is also performer, HostGameView shows the word.
  if (isHost) {
    return (
      <HostGameView
        word={word}
        isPerformer={isPerformer}
        performerName={performerName}
        nextPerformerName={nextPerformerName}
        wordNumber={wordNumber}
        totalWords={totalWords}
        timeLeft={timeLeft}
        timesUp={timesUp}
        onNext={onNext}
        onEndGame={onEndGame}
        onBackToLobby={onBackToLobby}
        t={t}
        fontStyle={fontStyle}
      />
    );
  }

  if (isPerformer) {
    return (
      <PerformerView
        word={word}
        wordNumber={wordNumber}
        totalWords={totalWords}
        timeLeft={timeLeft}
        timesUp={timesUp}
        t={t}
        fontStyle={fontStyle}
      />
    );
  }

  return (
    <SpectatorView
      performerName={performerName}
      wordNumber={wordNumber}
      totalWords={totalWords}
      timeLeft={timeLeft}
      timesUp={timesUp}
      t={t}
      fontStyle={fontStyle}
    />
  );
}

// ─── PERFORMER VIEW ───────────────────────────────────────────────────────────

function PerformerView({ word, wordNumber, totalWords, timeLeft, timesUp, t, fontStyle }: {
  word?: string; wordNumber: number; totalWords: number;
  timeLeft: number; timesUp: boolean;
  t: any; fontStyle: object;
}) {
  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-5 p-6 text-center select-none">
      {/* Word counter */}
      <span
        className="text-xs font-black uppercase tracking-widest"
        style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
      >
        {t.charadesWordNumber} {wordNumber}
      </span>

      {/* Your turn label */}
      <div>
        <p
          className="text-3xl font-black mb-1"
          style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
        >
          {t.charadesYourTurn}
        </p>
        <p
          className="text-base"
          style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
        >
          {t.charadesPerformWord}
        </p>
      </div>

      {/* Timer */}
      {!timesUp ? (
        <HourglassTimer seconds={timeLeft} />
      ) : (
        <p
          className="text-4xl font-black"
          style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
        >
          {t.charadesTimesUp}
        </p>
      )}

      {/* The word — 18pt */}
      <div
        className="font-black text-center leading-snug px-4 break-words"
        style={{
          fontSize: '18pt',
          color: '#000',
          textShadow: SHARP,
          maxWidth: '90vw',
          fontFamily: (fontStyle as any).fontFamily || undefined,
          opacity: timesUp ? 0.4 : 1,
          transition: 'opacity 0.5s',
        }}
      >
        {word ?? '...'}
      </div>
    </div>
  );
}

// ─── HOST GAME VIEW ───────────────────────────────────────────────────────────

function HostGameView({
  word, isPerformer, performerName, nextPerformerName, wordNumber, totalWords,
  timeLeft, timesUp,
  onNext, onEndGame, onBackToLobby, t, fontStyle,
}: {
  word?: string; isPerformer: boolean; performerName: string; nextPerformerName: string;
  wordNumber: number; totalWords: number;
  timeLeft: number; timesUp: boolean;
  onNext: () => void; onEndGame: () => void; onBackToLobby: () => void;
  t: any; fontStyle: object;
}) {
  const isUrgent = timeLeft <= 10 && !timesUp;

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-5 gap-4 max-w-md mx-auto w-full text-center">
      {/* Badge */}
      <span
        className="text-xs font-black uppercase tracking-widest"
        style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
      >
        {isPerformer ? t.charadesYourTurn : t.charadesAdminLabel}
      </span>

      {/* Timer */}
      {!timesUp ? (
        <HourglassTimer seconds={timeLeft} />
      ) : (
        <p
          className="text-3xl font-black"
          style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
        >
          {t.charadesTimesUp}
        </p>
      )}

      {/* Word number */}
      <span
        className="text-xs font-black uppercase tracking-widest"
        style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
      >
        {t.charadesWordNumber} {wordNumber}
      </span>

      {/* Word or performer name */}
      {isPerformer ? (
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'rgba(0,0,0,0.55)', textShadow: SHARP, ...fontStyle }}
          >
            {t.charadesPerformWord}
          </p>
          <p
            className="font-black leading-snug break-words"
            style={{
              fontSize: '18pt',
              color: '#000',
              textShadow: SHARP,
              opacity: timesUp ? 0.4 : 1,
              transition: 'opacity 0.5s',
              fontFamily: (fontStyle as any).fontFamily || undefined,
            }}
          >
            {word ?? '...'}
          </p>
        </div>
      ) : (
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: 'rgba(0,0,0,0.55)', textShadow: SHARP, ...fontStyle }}
          >
            {t.charadesCurrentPerformer}
          </p>
          <p
            className="text-2xl font-black"
            style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
          >
            {performerName}
          </p>
        </div>
      )}

      {/* Up next */}
      {nextPerformerName && nextPerformerName !== performerName && (
        <p
          className="text-sm"
          style={{ color: 'rgba(0,0,0,0.55)', textShadow: SHARP, ...fontStyle }}
        >
          {t.charadesUpNext}: <span className="font-black" style={{ color: '#000' }}>{nextPerformerName}</span>
        </p>
      )}

      {/* End Turn */}
      <button
        className="w-full h-16 text-xl font-black transition-all"
        style={{
          background: isUrgent || timesUp
            ? `linear-gradient(135deg, ${PINK}, #c0184d)`
            : `linear-gradient(135deg, ${ORANGE}, #b84508)`,
          border: `2px solid ${isUrgent || timesUp ? PINK : ORANGE}`,
          borderRadius: 12,
          color: '#000',
          textShadow: SHARP,
          ...fontStyle,
        }}
        onClick={onNext}
      >
        {t.charadesEndTurn}
      </button>

      {/* Secondary controls */}
      <div className="flex gap-3 w-full">
        <button
          className="flex-1 h-10 font-bold transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(0,0,0,0.08)',
            border: '1.5px solid rgba(0,0,0,0.2)',
            borderRadius: 10,
            color: '#000',
            textShadow: SHARP,
            ...fontStyle,
          }}
          onClick={onBackToLobby}
        >
          {t.backToLobby}
        </button>
        <button
          className="flex-1 h-10 font-bold transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(232,77,122,0.15)',
            border: `1.5px solid ${PINK}`,
            borderRadius: 10,
            color: '#000',
            textShadow: SHARP,
            ...fontStyle,
          }}
          onClick={onEndGame}
        >
          {t.charadesEndGame}
        </button>
      </div>

      <p
        className="text-xs text-center"
        style={{ color: 'rgba(0,0,0,0.4)', textShadow: SHARP, ...fontStyle }}
      >
        {t.charadesHostInstructions}
      </p>
    </div>
  );
}

// ─── SPECTATOR VIEW ───────────────────────────────────────────────────────────

function SpectatorView({ performerName, wordNumber, totalWords, timeLeft, timesUp, t, fontStyle }: {
  performerName: string; wordNumber: number; totalWords: number;
  timeLeft: number; timesUp: boolean;
  t: any; fontStyle: object;
}) {
  const watchingTitle = (t.charadesWatchingTitle as string).replace('{name}', performerName);

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center gap-5">
      {/* Word counter */}
      <span
        className="text-xs font-black uppercase tracking-widest"
        style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
      >
        {t.charadesWordNumber} {wordNumber}
      </span>

      {/* Performer name */}
      <div>
        <p
          className="font-black leading-tight"
          style={{
            fontSize: 'clamp(26px, 7vw, 56px)',
            color: '#000',
            textShadow: SHARP,
            ...fontStyle,
          }}
        >
          {watchingTitle}
        </p>
        <p
          className="text-base mt-2"
          style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
        >
          {t.charadesWatchingDesc}
        </p>
      </div>

      {/* Timer */}
      {!timesUp ? (
        <HourglassTimer seconds={timeLeft} />
      ) : (
        <p
          className="text-3xl font-black"
          style={{ color: '#000', textShadow: SHARP, ...fontStyle }}
        >
          {t.charadesTimesUp}
        </p>
      )}
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
      <h1
        className="font-black"
        style={{
          fontSize: 'clamp(40px, 10vw, 80px)',
          color: '#000',
          textShadow: SHARP,
          ...fontStyle,
        }}
      >
        {t.gameOver}
      </h1>
      <button
        className="h-14 px-10 text-xl font-black"
        style={{
          background: `linear-gradient(135deg, ${ORANGE}, ${PINK})`,
          border: `2px solid ${ORANGE}`,
          borderRadius: 12,
          color: '#000',
          textShadow: SHARP,
          ...fontStyle,
        }}
        onClick={onGoHome}
      >
        {t.goHome}
      </button>
    </div>
  );
}

import { useState } from 'react';
import { Copy, Check, Users, ChevronRight, Eye, RotateCcw, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/context/LanguageContext';
import { RoomState, CharacterState } from '@/hooks/useGameSocket';

interface CharacterRoomProps {
  code: string;
  playerId: number;
  roomState: RoomState | null;
  socket: {
    error: string | null;
    characterState: CharacterState | null;
    gtcStart: () => void;
    gtcNextHint: () => void;
    gtcRevealAnswer: () => void;
    gtcNextCharacter: () => void;
    gtcTransferAdmin: (id: number) => void;
    gtcEndGame: () => void;
    gtcBackToLobby: () => void;
  };
  onGoHome: () => void;
}

// ─── NEON FLICKER OVERLAY ──────────────────────────────────────────────────────

function NeonFlicker() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
      {/* Top pink neon bar — matches the wide pink strip at top of image */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '60px',
          background: 'linear-gradient(to bottom, rgba(255,20,200,0.92), transparent)',
          animation: 'flicker-fast 2.4s infinite',
        }}
      />
      {/* Left vending machine pink glow */}
      <div
        style={{
          position: 'absolute', top: '5%', left: 0, width: '55%', height: '75%',
          background: 'radial-gradient(ellipse at 30% 40%, rgba(255,10,210,0.38), transparent 68%)',
          animation: 'flicker-pink 4.3s infinite 0.6s',
        }}
      />
      {/* Second vending machine — slightly offset flicker */}
      <div
        style={{
          position: 'absolute', top: '8%', left: '20%', width: '45%', height: '65%',
          background: 'radial-gradient(ellipse at 60% 40%, rgba(255,60,220,0.28), transparent 65%)',
          animation: 'flicker-pink 3.7s infinite 1.1s',
        }}
      />
      {/* Cyan signs on the right */}
      <div
        style={{
          position: 'absolute', top: '2%', right: 0, width: '35%', height: '65%',
          background: 'radial-gradient(ellipse at 70% 25%, rgba(0,220,255,0.42), transparent 60%)',
          animation: 'flicker-cyan 3.9s infinite 0.3s',
        }}
      />
      {/* Small cyan accent top-right */}
      <div
        style={{
          position: 'absolute', top: '15%', right: '5%', width: '18%', height: '30%',
          background: 'radial-gradient(ellipse, rgba(0,200,255,0.55), transparent 65%)',
          animation: 'flicker-fast 1.8s infinite 0.9s',
        }}
      />
      {/* Floor wet reflection */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%',
          background: 'linear-gradient(to top, rgba(200,0,180,0.35), transparent)',
          animation: 'flicker-slow 5.2s infinite 1.4s',
        }}
      />
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function CharacterRoom({ code, playerId, roomState, socket, onGoHome }: CharacterRoomProps) {
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const fontStyle = isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 700 } : {};

  const status = roomState?.status ?? 'waiting';
  const isPlaying = status === 'character_playing';

  const bgImage = isPlaying ? '/character-bg-blur.png' : '/character-bg.png';

  return (
    <div
      className="min-h-[100dvh] text-white flex flex-col relative overflow-hidden"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1 }} />

      {/* Neon flicker lights */}
      <NeonFlicker />

      {socket.error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground p-3 text-center font-bold text-lg">
          {socket.error}
        </div>
      )}

      {status === 'waiting' && roomState && (
        <CharacterLobbyView
          roomCode={code}
          playerId={playerId}
          roomState={roomState}
          onStart={socket.gtcStart}
          onGoHome={onGoHome}
          fontStyle={fontStyle}
          t={t}
        />
      )}

      {status === 'character_playing' && roomState && (
        <CharacterGameView
          playerId={playerId}
          roomState={roomState}
          characterState={socket.characterState}
          onNextHint={socket.gtcNextHint}
          onRevealAnswer={socket.gtcRevealAnswer}
          onNextCharacter={socket.gtcNextCharacter}
          onTransferAdmin={socket.gtcTransferAdmin}
          onBackToLobby={socket.gtcBackToLobby}
          fontStyle={fontStyle}
          t={t}
        />
      )}

      {status === 'finished' && (
        <FinishedView onGoHome={onGoHome} t={t} fontStyle={fontStyle} />
      )}
    </div>
  );
}

// ─── LOBBY ─────────────────────────────────────────────────────────────────────

function CharacterLobbyView({
  roomCode, playerId, roomState, onStart, onGoHome, fontStyle, t,
}: {
  roomCode: string;
  playerId: number;
  roomState: RoomState;
  onStart: () => void;
  onGoHome: () => void;
  fontStyle: object;
  t: any;
}) {
  const [copied, setCopied] = useState(false);
  const players = roomState.players;
  const isHost = players.find(p => p.id === playerId)?.isHost ?? false;
  const connected = players.filter(p => p.connected);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex-1 flex flex-col p-6 gap-6 max-w-2xl mx-auto w-full" style={{ zIndex: 10 }}>
      {/* Title */}
      <div className="text-center pt-2">
        <h1
          className="font-black leading-none tracking-tight"
          style={{
            fontSize: 'clamp(32px, 9vw, 72px)',
            color: '#39d5ff',
            textShadow: '0 0 20px rgba(57,213,255,0.9), 0 0 40px rgba(57,213,255,0.5)',
            ...fontStyle,
          }}
        >
          {t.guessTheCharacter}
        </h1>
      </div>

      {/* Room code */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1" style={fontStyle}>{t.roomCodeLabel}</p>
        <div className="flex items-center justify-center gap-3">
          <span
            className="text-6xl font-black tracking-widest"
            style={{ color: '#39d5ff', textShadow: '0 0 16px rgba(57,213,255,0.8)' }}
          >
            {roomCode}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 bg-white/10 hover:bg-white/20 transition-colors"
          >
            {copied ? <Check className="w-6 h-6 text-green-400" /> : <Copy className="w-6 h-6 text-white" />}
          </button>
        </div>
      </div>

      {/* Players */}
      <div
        className="border-2 border-white/20 overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-white/20" style={{ background: 'rgba(57,213,255,0.08)' }}>
          <Users className="w-5 h-5 text-[#39d5ff]" />
          <span className="font-bold text-lg text-white" style={fontStyle}>{t.players} ({connected.length})</span>
        </div>
        <ul className="divide-y divide-white/10">
          {players.map(p => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <span
                className="text-xl font-bold"
                style={{ color: p.id === playerId ? '#39d5ff' : '#fff', ...fontStyle }}
              >
                {p.name} {p.id === playerId && <span className="text-base font-normal text-white/50">{t.you}</span>}
              </span>
              {p.isHost && (
                <span
                  className="text-xs font-bold px-2 py-1 border border-[#39d5ff]/40"
                  style={{ background: 'rgba(57,213,255,0.12)', color: '#39d5ff', ...fontStyle }}
                >
                  {t.host}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-16 text-2xl font-black rounded-none"
            style={{
              background: '#39d5ff',
              color: '#000',
              boxShadow: '0 0 24px rgba(57,213,255,0.5)',
              ...fontStyle,
            }}
            disabled={connected.length < 2}
            onClick={onStart}
          >
            {t.startGame}
          </Button>
          {connected.length < 2 && (
            <p className="text-center text-white/60 font-medium" style={fontStyle}>{t.need2Players}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="w-10 h-10 animate-spin text-[#39d5ff]" />
          <p className="text-xl font-bold text-white" style={fontStyle}>{t.waitingForHost}</p>
        </div>
      )}

      <button
        onClick={onGoHome}
        className="text-white/50 text-sm underline underline-offset-4 mx-auto hover:text-white transition-colors"
        style={fontStyle}
      >
        {t.goHome}
      </button>
    </div>
  );
}

// ─── GAME VIEW ─────────────────────────────────────────────────────────────────

function CharacterGameView({
  playerId, roomState, characterState,
  onNextHint, onRevealAnswer, onNextCharacter, onTransferAdmin, onBackToLobby,
  fontStyle, t,
}: {
  playerId: number;
  roomState: RoomState;
  characterState: CharacterState | null;
  onNextHint: () => void;
  onRevealAnswer: () => void;
  onNextCharacter: () => void;
  onTransferAdmin: (id: number) => void;
  onBackToLobby: () => void;
  fontStyle: object;
  t: any;
}) {
  const [showTransfer, setShowTransfer] = useState(false);

  if (!characterState) {
    return (
      <div className="relative flex-1 flex items-center justify-center" style={{ zIndex: 10 }}>
        <Loader2 className="w-16 h-16 animate-spin text-[#39d5ff]" />
      </div>
    );
  }

  const isAdmin = characterState.isAdmin;
  const adminPlayer = roomState.players.find(p => p.id === characterState.adminId);
  const connectedOtherPlayers = roomState.players.filter(
    p => p.connected && p.id !== playerId
  );

  if (isAdmin) {
    return (
      <AdminGameView
        characterState={characterState}
        players={roomState.players}
        connectedOtherPlayers={connectedOtherPlayers}
        adminPlayer={adminPlayer}
        showTransfer={showTransfer}
        setShowTransfer={setShowTransfer}
        onNextHint={onNextHint}
        onRevealAnswer={onRevealAnswer}
        onNextCharacter={onNextCharacter}
        onTransferAdmin={(id) => { onTransferAdmin(id); setShowTransfer(false); }}
        onBackToLobby={onBackToLobby}
        fontStyle={fontStyle}
        t={t}
      />
    );
  }

  return (
    <PlayerGameView
      characterState={characterState}
      adminPlayer={adminPlayer}
      fontStyle={fontStyle}
      t={t}
    />
  );
}

// ─── ADMIN VIEW ────────────────────────────────────────────────────────────────

function AdminGameView({
  characterState, players, connectedOtherPlayers, adminPlayer,
  showTransfer, setShowTransfer,
  onNextHint, onRevealAnswer, onNextCharacter, onTransferAdmin, onBackToLobby,
  fontStyle, t,
}: {
  characterState: CharacterState;
  players: RoomState['players'];
  connectedOtherPlayers: RoomState['players'];
  adminPlayer: RoomState['players'][0] | undefined;
  showTransfer: boolean;
  setShowTransfer: (v: boolean) => void;
  onNextHint: () => void;
  onRevealAnswer: () => void;
  onNextCharacter: () => void;
  onTransferAdmin: (id: number) => void;
  onBackToLobby: () => void;
  fontStyle: object;
  t: any;
}) {
  const hints = characterState.hints ?? [];
  const currentIdx = characterState.currentHintIndex;
  const allHintsShown = currentIdx >= hints.length - 1;

  const cardStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(10px)',
    border: '2px solid rgba(255,255,255,0.12)',
  };

  return (
    <div className="relative flex flex-col min-h-[100dvh] p-4 gap-4 max-w-2xl mx-auto w-full" style={{ zIndex: 10 }}>
      {/* Admin badge */}
      <div className="flex items-center justify-between pt-1">
        <span
          className="px-3 py-1 text-xs font-bold border"
          style={{ background: 'rgba(255,208,0,0.15)', color: '#ffd000', borderColor: 'rgba(255,208,0,0.4)', ...fontStyle }}
        >
          🎮 {t.youAreGameAdmin}
        </span>
        <span className="text-xs text-white/50" style={fontStyle}>
          🕵️ {t.guessTheCharacter}
        </span>
      </div>

      {/* Answer box */}
      <div
        className="p-5"
        style={{
          background: 'rgba(255,208,0,0.08)',
          border: '3px solid #ffd000',
          boxShadow: '0 0 24px rgba(255,208,0,0.35)',
        }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-[#ffd000] mb-2" style={fontStyle}>
          {t.theAnswer}
        </p>
        <p
          className="text-4xl font-black leading-tight text-white"
          style={{ ...fontStyle, textShadow: '0 0 20px rgba(255,208,0,0.7)' }}
        >
          {characterState.answer}
        </p>
      </div>

      {/* Hint progress */}
      <div className="p-4" style={cardStyle}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold uppercase tracking-widest text-white/50" style={fontStyle}>
            {t.hintLabel}
          </p>
          <span className="text-sm font-bold text-[#39d5ff]" style={fontStyle}>
            {currentIdx >= 0 ? `${currentIdx + 1} ${t.hintOf} ${hints.length}` : `0 ${t.hintOf} ${hints.length}`}
          </span>
        </div>

        {currentIdx < 0 ? (
          <p className="text-white/40 italic text-sm" style={fontStyle}>{t.noHintShownYet}</p>
        ) : (
          <div className="space-y-2">
            {hints.map((hint, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-2 transition-all ${
                  idx === currentIdx
                    ? 'border-2 border-[#39d5ff]'
                    : idx < currentIdx
                    ? 'opacity-40'
                    : 'opacity-20'
                }`}
                style={idx === currentIdx ? { background: 'rgba(57,213,255,0.12)' } : undefined}
              >
                <span className={`text-xs font-black mt-0.5 w-6 shrink-0 ${idx === currentIdx ? 'text-[#39d5ff]' : 'text-white/40'}`}>
                  {idx + 1}
                </span>
                <p className={`text-sm font-medium ${idx === currentIdx ? 'text-white' : 'text-white/50'}`} style={fontStyle}>
                  {hint}
                </p>
                {idx === currentIdx && (
                  <span className="text-xs font-bold text-[#39d5ff] ml-auto shrink-0">← LIVE</span>
                )}
              </div>
            ))}
          </div>
        )}

        {characterState.answerRevealed && (
          <div className="mt-3 flex items-center gap-2 text-green-400 font-bold text-sm" style={fontStyle}>
            <Eye className="w-4 h-4" />
            {t.answerRevealedLabel}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-14 font-black rounded-none col-span-2"
          style={{
            background: '#39d5ff', color: '#000',
            boxShadow: '0 0 16px rgba(57,213,255,0.4)',
            ...fontStyle,
          }}
          onClick={onNextHint}
          disabled={allHintsShown}
        >
          <ChevronRight className="w-5 h-5 mr-1" />
          {allHintsShown ? t.allHintsRevealed : t.nextHint}
        </Button>

        <Button
          size="lg"
          className="h-14 font-black rounded-none"
          style={{
            background: '#ffd000', color: '#000',
            boxShadow: '0 0 16px rgba(255,208,0,0.35)',
            ...fontStyle,
          }}
          onClick={onRevealAnswer}
          disabled={characterState.answerRevealed}
        >
          <Eye className="w-5 h-5 mr-1" />
          {t.revealAnswer}
        </Button>

        <Button
          size="lg"
          className="h-14 font-black rounded-none"
          style={{
            background: '#ff4fa3', color: '#fff',
            boxShadow: '0 0 16px rgba(255,79,163,0.35)',
            ...fontStyle,
          }}
          onClick={onNextCharacter}
        >
          <ArrowRight className="w-5 h-5 mr-1" />
          {t.nextCharacter}
        </Button>
      </div>

      {/* Transfer admin */}
      {!showTransfer ? (
        <Button
          variant="outline"
          className="rounded-none font-bold border-2 border-white/20 text-white bg-transparent hover:bg-white/10"
          style={fontStyle}
          onClick={() => setShowTransfer(true)}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t.transferAdmin}
        </Button>
      ) : (
        <div className="p-4 space-y-3" style={cardStyle}>
          <p className="font-bold text-sm text-white" style={fontStyle}>{t.selectNewAdmin}</p>
          <div className="space-y-2">
            {connectedOtherPlayers.map(p => (
              <button
                key={p.id}
                onClick={() => onTransferAdmin(p.id)}
                className="w-full text-left px-4 py-3 border-2 border-white/20 hover:border-[#39d5ff] transition-colors font-bold text-white"
                style={{ background: 'rgba(57,213,255,0.05)', ...fontStyle }}
              >
                {p.name}
              </button>
            ))}
            {connectedOtherPlayers.length === 0 && (
              <p className="text-white/40 text-sm" style={fontStyle}>No other players connected.</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white"
            onClick={() => setShowTransfer(false)}
            style={fontStyle}
          >
            {t.cancel}
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-white/50 hover:text-white"
        style={fontStyle}
        onClick={onBackToLobby}
      >
        {t.backToLobby}
      </Button>
    </div>
  );
}

// ─── PLAYER VIEW ───────────────────────────────────────────────────────────────

function PlayerGameView({
  characterState, adminPlayer, fontStyle, t,
}: {
  characterState: CharacterState;
  adminPlayer: RoomState['players'][0] | undefined;
  fontStyle: object;
  t: any;
}) {
  const currentHint = (characterState as any).currentHint as string | null | undefined;
  const revealedAnswer = (characterState as any).revealedAnswer as string | undefined;

  return (
    <div
      className="relative flex-1 flex flex-col items-center justify-center p-6 gap-8 max-w-lg mx-auto w-full text-center"
      style={{ zIndex: 10 }}
    >
      {/* Mode badge */}
      <span
        className="px-4 py-1.5 text-sm font-bold border-2 text-[#39d5ff]"
        style={{ borderColor: 'rgba(57,213,255,0.5)', background: 'rgba(57,213,255,0.08)', ...fontStyle }}
      >
        🕵️ {t.guessTheCharacter}
      </span>

      {/* Admin label */}
      {adminPlayer && (
        <p className="text-sm text-white/60" style={fontStyle}>
          {t.gameAdminLabel}: <span className="font-bold text-white">{adminPlayer.name}</span>
        </p>
      )}

      {/* Answer revealed */}
      {characterState.answerRevealed && revealedAnswer ? (
        <div
          className="w-full p-8"
          style={{
            border: '3px solid #ffd000',
            background: 'rgba(255,208,0,0.08)',
            boxShadow: '0 0 40px rgba(255,208,0,0.4)',
          }}
        >
          <p className="text-sm font-bold uppercase tracking-widest text-[#ffd000] mb-3" style={fontStyle}>
            {t.theAnswerIs}
          </p>
          <p
            className="text-5xl font-black leading-tight"
            style={{ ...fontStyle, color: '#ffd000', textShadow: '0 0 24px rgba(255,208,0,0.9)' }}
          >
            {revealedAnswer}
          </p>
        </div>
      ) : (
        <>
          {currentHint ? (
            <div
              className="w-full p-8"
              style={{
                border: '3px solid #39d5ff',
                background: 'rgba(57,213,255,0.07)',
                boxShadow: '0 0 40px rgba(57,213,255,0.35)',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-[#39d5ff] mb-3" style={fontStyle}>
                {t.currentHintLabel}
              </p>
              <p
                className="text-3xl font-black leading-tight text-white"
                style={{ ...fontStyle, textShadow: '0 0 20px rgba(57,213,255,0.6)' }}
              >
                {currentHint}
              </p>
            </div>
          ) : (
            <div
              className="w-full p-8"
              style={{ border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)' }}
            >
              <Loader2 className="w-8 h-8 animate-spin text-[#39d5ff] mx-auto mb-3" />
              <p className="text-white/60 font-medium" style={fontStyle}>{t.waitingForFirstHint}</p>
            </div>
          )}
        </>
      )}

      {!characterState.answerRevealed && characterState.currentHintIndex >= 0 && (
        <p className="text-sm text-white/50" style={fontStyle}>
          {t.hintLabel} #{characterState.currentHintIndex + 1}
        </p>
      )}
    </div>
  );
}

// ─── FINISHED VIEW ─────────────────────────────────────────────────────────────

function FinishedView({ onGoHome, t, fontStyle }: { onGoHome: () => void; t: any; fontStyle: object }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center gap-6 p-6" style={{ zIndex: 10 }}>
      <h1
        className="text-6xl font-black text-center"
        style={{ color: '#39d5ff', textShadow: '0 0 30px rgba(57,213,255,0.8)', ...fontStyle }}
      >
        {t.gameOver}
      </h1>
      <Button
        size="lg"
        className="h-16 px-10 text-xl rounded-none"
        style={{ background: '#39d5ff', color: '#000', boxShadow: '0 0 24px rgba(57,213,255,0.5)', ...fontStyle }}
        onClick={onGoHome}
      >
        {t.goHome}
      </Button>
    </div>
  );
}

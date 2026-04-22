import { useState } from 'react';
import { useLocation } from 'wouter';
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

export default function CharacterRoom({ code, playerId, roomState, socket, onGoHome }: CharacterRoomProps) {
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const fontStyle = isAr ? { fontFamily: "'Changa', sans-serif", fontWeight: 700 } : {};

  const status = roomState?.status ?? 'waiting';

  return (
    <div className="min-h-[100dvh] text-foreground flex flex-col relative overflow-hidden bg-background">
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

// ─── LOBBY ────────────────────────────────────────────────────────────────────

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
    <div className="flex-1 flex flex-col p-6 gap-6 max-w-2xl mx-auto w-full">
      {/* Mode badge */}
      <div className="flex justify-center">
        <span
          className="px-4 py-1.5 rounded-full text-sm font-bold border-2 border-[#39d5ff] text-[#39d5ff] bg-[#39d5ff]/10"
          style={fontStyle}
        >
          🕵️ {t.guessTheCharacter}
        </span>
      </div>

      {/* Room code */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1" style={fontStyle}>{t.roomCodeLabel}</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-6xl font-black tracking-widest text-[#39d5ff]">{roomCode}</span>
          <button onClick={handleCopy} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
            {copied ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="bg-card border-2 border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-border bg-muted/50">
          <Users className="w-5 h-5 text-[#39d5ff]" />
          <span className="font-bold text-lg" style={fontStyle}>{t.players} ({connected.length})</span>
        </div>
        <ul className="divide-y divide-border">
          {players.map(p => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className={`text-xl font-bold ${p.id === playerId ? 'text-[#39d5ff]' : ''}`} style={fontStyle}>
                {p.name} {p.id === playerId && <span className="text-base font-normal text-muted-foreground">{t.you}</span>}
              </span>
              {p.isHost && (
                <span className="text-xs font-bold bg-[#39d5ff]/10 text-[#39d5ff] px-2 py-1 rounded-full border border-[#39d5ff]/30" style={fontStyle}>
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
            className="w-full h-16 text-2xl font-black rounded-2xl bg-[#39d5ff] hover:bg-[#39d5ff]/90 text-black"
            style={fontStyle}
            disabled={connected.length < 2}
            onClick={onStart}
          >
            {t.startGame}
          </Button>
          {connected.length < 2 && (
            <p className="text-center text-muted-foreground font-medium" style={fontStyle}>{t.need2Players}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="w-10 h-10 animate-spin text-[#39d5ff]" />
          <p className="text-xl font-bold" style={fontStyle}>{t.waitingForHost}</p>
        </div>
      )}

      <button
        onClick={onGoHome}
        className="text-muted-foreground text-sm underline underline-offset-4 mx-auto hover:text-foreground"
        style={fontStyle}
      >
        {t.goHome}
      </button>
    </div>
  );
}

// ─── GAME VIEW ────────────────────────────────────────────────────────────────

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
      <div className="flex-1 flex items-center justify-center">
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

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────

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

  return (
    <div className="flex flex-col min-h-[100dvh] p-4 gap-4 max-w-2xl mx-auto w-full">
      {/* Admin badge */}
      <div className="flex items-center justify-between">
        <span
          className="px-3 py-1 rounded-full text-xs font-bold bg-[#ffd000]/20 text-[#ffd000] border border-[#ffd000]/40"
          style={fontStyle}
        >
          🎮 {t.youAreGameAdmin}
        </span>
        <span className="text-xs text-muted-foreground" style={fontStyle}>
          🕵️ {t.guessTheCharacter}
        </span>
      </div>

      {/* Answer box */}
      <div className="rounded-2xl border-4 border-[#ffd000] bg-[#ffd000]/10 p-5 shadow-[0_0_24px_#ffd00040]">
        <p className="text-xs font-bold uppercase tracking-widest text-[#ffd000] mb-2" style={fontStyle}>
          {t.theAnswer}
        </p>
        <p
          className="text-4xl font-black leading-tight text-white"
          style={{ ...fontStyle, textShadow: '0 0 20px rgba(255,208,0,0.6)' }}
        >
          {characterState.answer}
        </p>
      </div>

      {/* Hint progress */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground" style={fontStyle}>
            {t.hintLabel}
          </p>
          <span className="text-sm font-bold text-[#39d5ff]" style={fontStyle}>
            {currentIdx >= 0 ? `${currentIdx + 1} ${t.hintOf} ${hints.length}` : `0 ${t.hintOf} ${hints.length}`}
          </span>
        </div>

        {currentIdx < 0 ? (
          <p className="text-muted-foreground italic text-sm" style={fontStyle}>{t.noHintShownYet}</p>
        ) : (
          <div className="space-y-2">
            {hints.map((hint, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-2 rounded-xl transition-all ${
                  idx === currentIdx
                    ? 'bg-[#39d5ff]/15 border-2 border-[#39d5ff]'
                    : idx < currentIdx
                    ? 'opacity-40'
                    : 'opacity-20'
                }`}
              >
                <span className={`text-xs font-black mt-0.5 w-6 shrink-0 ${idx === currentIdx ? 'text-[#39d5ff]' : 'text-muted-foreground'}`}>
                  {idx + 1}
                </span>
                <p className={`text-sm font-medium ${idx === currentIdx ? 'text-foreground' : 'text-muted-foreground'}`} style={fontStyle}>
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
          className="h-14 font-black rounded-2xl bg-[#39d5ff] hover:bg-[#39d5ff]/90 text-black col-span-2"
          style={fontStyle}
          onClick={onNextHint}
          disabled={allHintsShown}
        >
          <ChevronRight className="w-5 h-5 mr-1" />
          {allHintsShown ? t.allHintsRevealed : t.nextHint}
        </Button>

        <Button
          size="lg"
          className="h-14 font-black rounded-2xl bg-[#ffd000] hover:bg-[#ffd000]/90 text-black"
          style={fontStyle}
          onClick={onRevealAnswer}
          disabled={characterState.answerRevealed}
        >
          <Eye className="w-5 h-5 mr-1" />
          {t.revealAnswer}
        </Button>

        <Button
          size="lg"
          className="h-14 font-black rounded-2xl bg-[#ff4fa3] hover:bg-[#ff4fa3]/90 text-white"
          style={fontStyle}
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
          className="rounded-2xl font-bold border-2"
          style={fontStyle}
          onClick={() => setShowTransfer(true)}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t.transferAdmin}
        </Button>
      ) : (
        <div className="rounded-2xl border-2 border-border bg-card p-4 space-y-3">
          <p className="font-bold text-sm" style={fontStyle}>{t.selectNewAdmin}</p>
          <div className="space-y-2">
            {connectedOtherPlayers.map(p => (
              <button
                key={p.id}
                onClick={() => onTransferAdmin(p.id)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-border hover:border-[#39d5ff] hover:bg-[#39d5ff]/10 transition-colors font-bold"
                style={fontStyle}
              >
                {p.name}
              </button>
            ))}
            {connectedOtherPlayers.length === 0 && (
              <p className="text-muted-foreground text-sm" style={fontStyle}>No other players connected.</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowTransfer(false)} style={fontStyle}>
            {t.cancel}
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        style={fontStyle}
        onClick={onBackToLobby}
      >
        {t.backToLobby}
      </Button>
    </div>
  );
}

// ─── PLAYER VIEW ──────────────────────────────────────────────────────────────

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
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 max-w-lg mx-auto w-full text-center">
      {/* Mode badge */}
      <span
        className="px-4 py-1.5 rounded-full text-sm font-bold border-2 border-[#39d5ff] text-[#39d5ff] bg-[#39d5ff]/10"
        style={fontStyle}
      >
        🕵️ {t.guessTheCharacter}
      </span>

      {/* Admin label */}
      {adminPlayer && (
        <p className="text-sm text-muted-foreground" style={fontStyle}>
          {t.gameAdminLabel}: <span className="font-bold text-foreground">{adminPlayer.name}</span>
        </p>
      )}

      {/* Answer revealed */}
      {characterState.answerRevealed && revealedAnswer ? (
        <div className="w-full rounded-2xl border-4 border-[#ffd000] bg-[#ffd000]/10 p-8 shadow-[0_0_32px_#ffd00050]">
          <p className="text-sm font-bold uppercase tracking-widest text-[#ffd000] mb-3" style={fontStyle}>
            {t.theAnswerIs}
          </p>
          <p
            className="text-5xl font-black leading-tight"
            style={{ ...fontStyle, color: '#ffd000', textShadow: '0 0 20px rgba(255,208,0,0.8)' }}
          >
            {revealedAnswer}
          </p>
        </div>
      ) : (
        <>
          {/* Current hint */}
          {currentHint ? (
            <div className="w-full rounded-2xl border-4 border-[#39d5ff] bg-[#39d5ff]/10 p-8 shadow-[0_0_32px_#39d5ff50]">
              <p className="text-xs font-bold uppercase tracking-widest text-[#39d5ff] mb-3" style={fontStyle}>
                {t.currentHintLabel}
              </p>
              <p
                className="text-3xl font-black leading-tight text-white"
                style={{ ...fontStyle, textShadow: '0 0 20px rgba(57,213,255,0.5)' }}
              >
                {currentHint}
              </p>
            </div>
          ) : (
            <div className="w-full rounded-2xl border-2 border-border bg-card p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#39d5ff] mx-auto mb-3" />
              <p className="text-muted-foreground font-medium" style={fontStyle}>{t.waitingForFirstHint}</p>
            </div>
          )}
        </>
      )}

      {/* Hint number badge (shows even before answer reveal) */}
      {!characterState.answerRevealed && characterState.currentHintIndex >= 0 && (
        <p className="text-sm text-muted-foreground" style={fontStyle}>
          {t.hintLabel} #{characterState.currentHintIndex + 1}
        </p>
      )}
    </div>
  );
}

// ─── FINISHED VIEW ────────────────────────────────────────────────────────────

function FinishedView({ onGoHome, t, fontStyle }: { onGoHome: () => void; t: any; fontStyle: object }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-6xl font-black text-center" style={fontStyle}>{t.gameOver}</h1>
      <Button size="lg" className="h-16 px-10 text-xl rounded-2xl" onClick={onGoHome} style={fontStyle}>
        {t.goHome}
      </Button>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';

export interface RoomState {
  code: string;
  status: 'waiting' | 'countdown' | 'word_display' | 'reveal' | 'finished' | 'character_playing';
  mode: 'forehead' | 'character';
  categoryId: number | null;
  categoryName: string | null;
  players: Array<{
    id: number;
    name: string;
    isHost: boolean;
    score: number;
    connected: boolean;
  }>;
}

export interface RoundInfo {
  roundNumber: number;
  myWord: string;
  isImposter: boolean;
  categoryName: string;
}

export interface RevealInfo {
  myWord: string;
  isImposter: boolean;
  imposterName: string;
  normalWord: string;
  imposterWord: string;
  categoryName: string;
  roundNumber: number;
  readyPlayerIds: number[];
}

export interface CharacterState {
  // Both admin and player
  isAdmin: boolean;
  currentHintIndex: number;
  answerRevealed: boolean;
  adminId: number;
  // Admin only
  answer?: string;
  hints?: string[];
  totalHints?: number;
  // Player only
  currentHint?: string | null;
  revealedAnswer?: string;
}

interface SocketState {
  isConnected: boolean;
  roomState: RoomState | null;
  countdownSeconds: number;
  roundInfo: RoundInfo | null;
  revealInfo: RevealInfo | null;
  readyPlayerIds: number[];
  characterState: CharacterState | null;
  error: string | null;
}

export function useGameSocket(roomCode: string, playerId: number | null, playerName: string | null) {
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    roomState: null,
    countdownSeconds: 7,
    roundInfo: null,
    revealInfo: null,
    readyPlayerIds: [],
    characterState: null,
    error: null,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!roomCode || !playerId || !playerName) return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setState(s => ({ ...s, isConnected: true, error: null }));
      socket.send(JSON.stringify({ type: 'join', payload: { roomCode, playerId, playerName } }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'roomUpdate':
            setState(s => ({ ...s, roomState: { mode: 'forehead', ...msg.payload } }));
            break;
          case 'countdownTick':
            setState(s => ({ ...s, countdownSeconds: msg.payload.secondsLeft }));
            break;
          case 'roundStart':
            setState(s => ({ ...s, roundInfo: msg.payload, revealInfo: null, readyPlayerIds: [] }));
            break;
          case 'revealInfo':
            setState(s => ({
              ...s,
              revealInfo: msg.payload,
              readyPlayerIds: msg.payload.readyPlayerIds ?? [],
            }));
            break;
          case 'readyUpdate':
            setState(s => ({ ...s, readyPlayerIds: msg.payload.readyPlayerIds ?? [] }));
            break;
          case 'gameEnd':
            setState(s => ({ ...s, roundInfo: null, revealInfo: null, readyPlayerIds: [], characterState: null }));
            break;
          case 'gtcState':
            setState(s => ({ ...s, characterState: msg.payload as CharacterState }));
            break;
          case 'error':
            setState(s => ({ ...s, error: msg.payload.message }));
            setTimeout(() => setState(s => ({ ...s, error: null })), 4000);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      setState(s => ({ ...s, isConnected: false }));
      if (shouldReconnectRef.current && roomCode && playerId && playerName) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
        reconnectAttemptsRef.current++;
        reconnectTimerRef.current = setTimeout(() => {
          if (shouldReconnectRef.current) connect();
        }, delay);
      }
    };

    socket.onerror = () => {
      setState(s => ({ ...s, error: 'Connection lost. Reconnecting...' }));
    };
  }, [roomCode, playerId, playerName]);

  useEffect(() => {
    if (!roomCode || !playerId || !playerName) return;
    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [roomCode, playerId, playerName, connect]);

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // ── Forehead game actions ─────────────────────────────────────────────────
  const setCategory = useCallback((categoryId: number) => {
    sendMessage('setCategory', { roomCode, categoryId });
  }, [roomCode, sendMessage]);

  const startGame = useCallback(() => {
    sendMessage('startGame', { roomCode });
  }, [roomCode, sendMessage]);

  const endRound = useCallback(() => {
    sendMessage('endRound', { roomCode });
  }, [roomCode, sendMessage]);

  const playerReady = useCallback(() => {
    sendMessage('playerReady', { roomCode });
  }, [roomCode, sendMessage]);

  const nextRound = useCallback(() => {
    sendMessage('nextRound', { roomCode });
  }, [roomCode, sendMessage]);

  const endGame = useCallback(() => {
    sendMessage('endGame', { roomCode });
  }, [roomCode, sendMessage]);

  const playAgain = useCallback(() => {
    sendMessage('playAgain', { roomCode });
  }, [roomCode, sendMessage]);

  // ── Character game actions ────────────────────────────────────────────────
  const gtcStart = useCallback(() => {
    sendMessage('gtcStart', { roomCode });
  }, [roomCode, sendMessage]);

  const gtcNextHint = useCallback(() => {
    sendMessage('gtcNextHint', { roomCode });
  }, [roomCode, sendMessage]);

  const gtcRevealAnswer = useCallback(() => {
    sendMessage('gtcRevealAnswer', { roomCode });
  }, [roomCode, sendMessage]);

  const gtcNextCharacter = useCallback(() => {
    sendMessage('gtcNextCharacter', { roomCode });
  }, [roomCode, sendMessage]);

  const gtcTransferAdmin = useCallback((targetPlayerId: number) => {
    sendMessage('gtcTransferAdmin', { roomCode, targetPlayerId });
  }, [roomCode, sendMessage]);

  const gtcEndGame = useCallback(() => {
    sendMessage('gtcEndGame', { roomCode });
  }, [roomCode, sendMessage]);

  const gtcBackToLobby = useCallback(() => {
    sendMessage('gtcBackToLobby', { roomCode });
  }, [roomCode, sendMessage]);

  return {
    ...state,
    setCategory,
    startGame,
    endRound,
    playerReady,
    nextRound,
    endGame,
    playAgain,
    gtcStart,
    gtcNextHint,
    gtcRevealAnswer,
    gtcNextCharacter,
    gtcTransferAdmin,
    gtcEndGame,
    gtcBackToLobby,
  };
}

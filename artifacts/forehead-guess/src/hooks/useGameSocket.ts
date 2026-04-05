import { useEffect, useRef, useState, useCallback } from 'react';

export interface RoomState {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  categoryId: number | null;
  categoryName: string | null;
  turnDuration: number;
  roundCount: number;
  players: Array<{
    id: number;
    name: string;
    isHost: boolean;
    score: number;
    connected: boolean;
  }>;
}

export interface TurnState {
  currentPlayerId: number;
  currentPlayerName: string;
  turnNumber: number;
  totalTurns: number;
  assignment: { itemText: string; imageUrl: string | null } | null;
  secondsLeft: number;
}

export interface GameResults {
  players: Array<{ id: number; name: string; score: number; correctGuesses: number; turnsPlayed: number }>;
  totalTurns: number;
  winnerId: number;
}

interface SocketState {
  isConnected: boolean;
  roomState: RoomState | null;
  turnState: TurnState | null;
  gameResults: GameResults | null;
  error: string | null;
}

export function useGameSocket(roomCode: string, playerId: number | null, playerName: string | null) {
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    roomState: null,
    turnState: null,
    gameResults: null,
    error: null,
  });

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomCode || !playerId || !playerName) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setState(s => ({ ...s, isConnected: true, error: null }));
      socket.send(JSON.stringify({
        type: 'join',
        payload: { roomCode, playerId, playerName }
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'roomUpdate':
            setState(s => ({ ...s, roomState: msg.payload }));
            break;
          case 'gameStarted':
            // The assignment payload is sent to the current player if it's their turn
            setState(s => ({ ...s, turnState: { ...s.turnState, assignment: msg.payload.assignment } as TurnState }));
            break;
          case 'turnUpdate':
            setState(s => ({ ...s, turnState: msg.payload }));
            break;
          case 'timerTick':
            setState(s => ({ ...s, turnState: s.turnState ? { ...s.turnState, secondsLeft: msg.payload.secondsLeft } : null }));
            break;
          case 'turnEnd':
            // msg.payload: { result: 'correct'|'pass'|'timeout', nextPlayerId: number|null }
            break;
          case 'gameEnd':
            setState(s => ({ ...s, gameResults: msg.payload, turnState: null }));
            break;
          case 'error':
            setState(s => ({ ...s, error: msg.payload.message }));
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      setState(s => ({ ...s, isConnected: false }));
    };

    socket.onerror = () => {
      setState(s => ({ ...s, error: 'WebSocket error occurred' }));
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomCode, playerId, playerName]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const setCategory = useCallback((categoryId: number) => {
    sendMessage('setCategory', { roomCode, categoryId });
  }, [roomCode, sendMessage]);

  const startGame = useCallback(() => {
    sendMessage('startGame', { roomCode });
  }, [roomCode, sendMessage]);

  const correct = useCallback(() => {
    sendMessage('correct', { roomCode });
  }, [roomCode, sendMessage]);

  const pass = useCallback(() => {
    sendMessage('pass', { roomCode });
  }, [roomCode, sendMessage]);

  const playAgain = useCallback(() => {
    sendMessage('playAgain', { roomCode });
  }, [roomCode, sendMessage]);

  return {
    ...state,
    setCategory,
    startGame,
    correct,
    pass,
    playAgain,
  };
}

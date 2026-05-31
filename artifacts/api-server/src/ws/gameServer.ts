import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import {
  roomsTable,
  playersTable,
  categoryItemsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getCharadesPool } from "../lib/charadesPool";
import { fetchForeheadWordsFromSupabase, fetchCharactersFromSupabase, SupabaseCharacterEntry } from "../lib/supabase-forehead";
type CharacterEntry = SupabaseCharacterEntry;

// ── CLIENT REGISTRY ──────────────────────────────────────────────────────────

interface WsClient {
  ws: WebSocket;
  roomCode: string | null;
  playerId: number | null;
  playerName: string | null;
}

// ── FOREHEAD GAME STATE ───────────────────────────────────────────────────────

interface RoundState {
  roundNumber: number;
  imposterId: number;
  imposterName: string;
  normalWord: string;
  imposterWord: string;
  categoryName: string;
  readyPlayerIds: number[];
  playerWords: Record<number, string>;
}

// ── CHARACTER GAME STATE ──────────────────────────────────────────────────────

interface PlayerGuess {
  playerId: number;
  playerName: string;
  guess: string;
  guessNumber: number;
}

interface CharacterRoundState {
  adminId: number;
  answer: string;
  hints: string[];
  currentHintIndex: number; // -1 = no hint shown yet
  answerRevealed: boolean;
  usedPoolIndices: number[]; // stores character IDs (DB ids)
  lang: string;
  playerGuesses: PlayerGuess[];
  guessCountByPlayer: Record<number, number>;
  lastGuessByPlayer: Record<number, number>; // playerId → hintIndex when they last guessed
}

// ── CHARADES GAME STATE ───────────────────────────────────────────────────────

interface CharadesRoundState {
  hostId: number;
  words: Array<{ id: number; answer: string }>;
  usedWordIds: number[];
  currentWord: string | null;
  currentWordId: number | null;
  currentPerformerIdx: number;
  playerQueue: number[];
  wordNumber: number;
  lang: string;
}

// ── DYKM GAME STATE ──────────────────────────────────────────────────────────

interface DykmGameState {
  hostId: number;
  askerId: number;
  askerName: string;
  targetScore: number;
  scores: Record<number, number>; // playerId -> score
  lastPointTo?: number;
  status: 'playing' | 'finished';
  winnerId?: number;
  winnerName?: string;
  lang: string;
  selectedQuestion?: { id: number; question: string; categoryName: string };
}

const clients = new Map<WebSocket, WsClient>();
const roomTimers = new Map<string, ReturnType<typeof setInterval>>();
const roomRoundState = new Map<string, RoundState>();
const roomCharacterState = new Map<string, CharacterRoundState>();
const roomCharadesState = new Map<string, CharadesRoundState>();
const roomDykmState = new Map<string, DykmGameState>();
// roomCode → Supabase category info for forehead mode
const roomSupabaseCategory = new Map<string, { table: string; category: string }>();

// ── HELPERS ───────────────────────────────────────────────────────────────────

function broadcast(roomCode: string, message: object, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === roomCode && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function sendTo(ws: WebSocket, message: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function clearRoomTimer(code: string) {
  const t = roomTimers.get(code);
  if (t) {
    clearInterval(t);
    roomTimers.delete(code);
  }
}

async function getRoomState(code: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, code) });
  if (!room) return null;
  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
  let categoryName: string | null = null;
  const supabaseCat = roomSupabaseCategory.get(code);
  if (supabaseCat) {
    categoryName = supabaseCat.category;
  } else if (room.categoryId) {
    const cat = await db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, room.categoryId) });
    categoryName = cat?.name ?? null;
  }
  return {
    code: room.code,
    status: room.status,
    mode: room.mode,
    lang: room.lang ?? "en",
    categoryId: supabaseCat ? null : (room.categoryId ?? null),
    categoryName,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score,
      connected: p.connected,
    })),
  };
}

// ── CHARACTER GAME HELPERS ────────────────────────────────────────────────────

async function pickNextCharacter(lang: string, existing: CharacterRoundState | undefined): Promise<{ entry: CharacterEntry; error?: string } | null> {
  const { characters, error } = await fetchCharactersFromSupabase(lang);
  if (characters.length === 0) {
    logger.warn({ lang, error }, '[CharacterGame] No characters returned from Supabase');
    return null;
  }

  const usedSoFar = existing?.usedPoolIndices ?? [];
  let available = characters.filter(e => !usedSoFar.includes(e.id));

  if (available.length === 0) {
    // All used — reset and start over
    available = characters;
  }

  const entry = available[Math.floor(Math.random() * available.length)];
  return { entry };
}

async function broadcastCharacterState(roomCode: string) {
  const cs = roomCharacterState.get(roomCode);
  if (!cs) return;

  for (const [ws2, c] of clients.entries()) {
    if (c.roomCode !== roomCode || ws2.readyState !== WebSocket.OPEN || !c.playerId) continue;

    const isAdmin = c.playerId === cs.adminId;

    if (isAdmin) {
      sendTo(ws2, {
        type: "gtcState",
        payload: {
          isAdmin: true,
          answer: cs.answer,
          hints: cs.hints,
          currentHintIndex: cs.currentHintIndex,
          answerRevealed: cs.answerRevealed,
          adminId: cs.adminId,
          totalHints: cs.hints.length,
          playerGuesses: cs.playerGuesses,
        },
      });
    } else {
      const currentHint = cs.currentHintIndex >= 0 ? cs.hints[cs.currentHintIndex] : null;
      const myGuessCount = cs.guessCountByPlayer[c.playerId] ?? 0;
      const myGuesses = cs.playerGuesses
        .filter((g) => g.playerId === c.playerId)
        .map((g) => g.guess);
      const isPenalized =
        cs.currentHintIndex >= 0 &&
        (cs.lastGuessByPlayer[c.playerId] ?? -99) === cs.currentHintIndex;
      sendTo(ws2, {
        type: "gtcState",
        payload: {
          isAdmin: false,
          currentHint,
          currentHintIndex: cs.currentHintIndex,
          answerRevealed: cs.answerRevealed,
          revealedAnswer: cs.answerRevealed ? cs.answer : undefined,
          adminId: cs.adminId,
          myGuessCount,
          myGuesses,
          isPenalized,
        },
      });
    }
  }
}

// ── DYKM GAME HELPERS ────────────────────────────────────────────────────────

async function broadcastDykmState(roomCode: string) {
  const ds = roomDykmState.get(roomCode);
  if (!ds) return;
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
  if (!room) return;
  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
  for (const [ws2, c2] of clients.entries()) {
    if (c2.roomCode !== roomCode || ws2.readyState !== WebSocket.OPEN) continue;
    sendTo(ws2, {
      type: "dykmState",
      payload: {
        askerId: ds.askerId,
        askerName: ds.askerName,
        targetScore: ds.targetScore,
        scores: ds.scores,
        lastPointTo: ds.lastPointTo,
        status: ds.status,
        winnerId: ds.winnerId,
        winnerName: ds.winnerName,
        selectedQuestion: ds.selectedQuestion,
        players: players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, connected: p.connected })),
      },
    });
  }
}

// ── CHARADES GAME HELPERS ─────────────────────────────────────────────────────

async function broadcastCharadesState(roomCode: string) {
  const cs = roomCharadesState.get(roomCode);
  if (!cs) return;
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
  if (!room) return;
  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));

  const performerId = cs.playerQueue[cs.currentPerformerIdx] ?? null;
  const performer = players.find((p) => p.id === performerId);
  const nextPerformerIdx = (cs.currentPerformerIdx + 1) % cs.playerQueue.length;
  const nextPerformerId = cs.playerQueue[nextPerformerIdx];
  const nextPerformer = players.find((p) => p.id === nextPerformerId);

  for (const [ws2, c] of clients.entries()) {
    if (c.roomCode !== roomCode || ws2.readyState !== WebSocket.OPEN || !c.playerId) continue;

    const isHost = c.playerId === cs.hostId;
    const isPerformer = c.playerId === performerId;

    sendTo(ws2, {
      type: "charadesState",
      payload: {
        isHost,
        isPerformer,
        hostId: cs.hostId,
        performerName: performer?.name ?? "",
        performerId,
        nextPerformerName: nextPerformer?.name ?? "",
        wordNumber: cs.wordNumber,
        totalWords: cs.words.length,
        word: isPerformer ? cs.currentWord : undefined,
      },
    });
  }
}

// ── FOREHEAD GAME LOGIC ───────────────────────────────────────────────────────

async function startCountdown(roomCode: string) {
  await db.update(roomsTable).set({ status: "countdown" }).where(eq(roomsTable.code, roomCode));
  broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });

  let secondsLeft = 7;
  broadcast(roomCode, { type: "countdownTick", payload: { secondsLeft } });

  clearRoomTimer(roomCode);
  const interval = setInterval(async () => {
    secondsLeft--;
    broadcast(roomCode, { type: "countdownTick", payload: { secondsLeft } });

    if (secondsLeft <= 0) {
      clearRoomTimer(roomCode);
      await beginWordDisplay(roomCode);
    }
  }, 1000);
  roomTimers.set(roomCode, interval);
}

async function beginWordDisplay(roomCode: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
  const supabaseCat = roomSupabaseCategory.get(roomCode);
  if (!room || (!room.categoryId && !supabaseCat)) return;

  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
  const connected = players.filter((p) => p.connected);
  if (connected.length < 2) return;

  let wordPool: string[];
  let categoryName: string;

  if (supabaseCat) {
    const result = await fetchForeheadWordsFromSupabase(supabaseCat.table, supabaseCat.category);
    if (result.error || result.words.length === 0) {
      broadcast(roomCode, { type: "error", payload: { message: result.error ?? `No words in "${supabaseCat.category}"` } });
      return;
    }
    wordPool = result.words;
    categoryName = supabaseCat.category;
  } else {
    const items = await db.select().from(categoryItemsTable).where(eq(categoryItemsTable.categoryId, room.categoryId!));
    wordPool = items.map((i) => i.itemText);
    const cat = await db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, room.categoryId!) });
    categoryName = cat?.name ?? "Unknown";
  }

  if (wordPool.length < connected.length) {
    broadcast(roomCode, {
      type: "error",
      payload: { message: `Need at least ${connected.length} words in this category for ${connected.length} players. Add more words or switch category.` },
    });
    return;
  }

  const shuffledWords = [...wordPool].sort(() => Math.random() - 0.5).slice(0, connected.length);
  const shuffledPlayers = [...connected].sort(() => Math.random() - 0.5);
  const imposterPlayer = shuffledPlayers[0];
  const normalPlayers = shuffledPlayers.slice(1);

  const playerWords: Record<number, string> = {};
  playerWords[imposterPlayer.id] = shuffledWords[0];
  normalPlayers.forEach((p, i) => {
    playerWords[p.id] = shuffledWords[i + 1];
  });

  const normalWord = normalPlayers.length > 0 ? playerWords[normalPlayers[0].id] : shuffledWords[1] ?? "";
  const imposterWord = playerWords[imposterPlayer.id];

  const existingRound = roomRoundState.get(roomCode);
  const roundNumber = (existingRound?.roundNumber ?? 0) + 1;

  const roundState: RoundState = {
    roundNumber,
    imposterId: imposterPlayer.id,
    imposterName: imposterPlayer.name,
    normalWord,
    imposterWord,
    categoryName,
    readyPlayerIds: [],
    playerWords,
  };
  roomRoundState.set(roomCode, roundState);

  await db.update(roomsTable).set({ status: "word_display" }).where(eq(roomsTable.code, roomCode));

  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === roomCode && ws.readyState === WebSocket.OPEN && client.playerId) {
      const isImposter = client.playerId === imposterPlayer.id;
      const myWord = playerWords[client.playerId] ?? "???";
      const allPlayerWords = connected.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        word: p.id === client.playerId ? "???" : (playerWords[p.id] ?? "???"),
      }));
      sendTo(ws, {
        type: "roundStart",
        payload: {
          roundNumber,
          myWord,
          isImposter,
          categoryName,
          allPlayerWords,
        },
      });
    }
  }

  broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
}

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────────

async function handleMessage(ws: WebSocket, client: WsClient, raw: string) {
  let msg: { type: string; payload: Record<string, unknown> };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  const { type, payload } = msg;

  // ── JOIN ──────────────────────────────────────────────────────────────────
  if (type === "join") {
    const { roomCode, playerId, playerName } = payload as { roomCode: string; playerId: number; playerName: string };
    client.roomCode = roomCode;
    client.playerId = Number(playerId);
    client.playerName = playerName;

    await db.update(playersTable).set({ connected: true }).where(eq(playersTable.id, Number(playerId)));

    const state = await getRoomState(roomCode);
    if (state) sendTo(ws, { type: "roomUpdate", payload: state });

    // Resend forehead game state if in progress
    const rs = roomRoundState.get(roomCode);
    if (rs && state?.status === "word_display" && client.playerId) {
      const isImposter = client.playerId === rs.imposterId;
      const myWord = rs.playerWords?.[client.playerId] ?? (isImposter ? rs.imposterWord : rs.normalWord);
      const allPlayerWords = state.players.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        word: p.id === client.playerId ? "???" : (rs.playerWords?.[p.id] ?? "???"),
      }));
      sendTo(ws, {
        type: "roundStart",
        payload: { roundNumber: rs.roundNumber, myWord, isImposter, categoryName: rs.categoryName, allPlayerWords },
      });
    }
    if (rs && state?.status === "reveal" && client.playerId) {
      const isImposter = client.playerId === rs.imposterId;
      const myWord = rs.playerWords?.[client.playerId] ?? (isImposter ? rs.imposterWord : rs.normalWord);
      sendTo(ws, {
        type: "revealInfo",
        payload: {
          myWord, isImposter, imposterName: rs.imposterName,
          normalWord: rs.normalWord, imposterWord: rs.imposterWord,
          categoryName: rs.categoryName, roundNumber: rs.roundNumber,
          readyPlayerIds: rs.readyPlayerIds,
        },
      });
    }

    // Resend character game state if in progress
    if (state?.status === "character_playing" && client.playerId) {
      const cs = roomCharacterState.get(roomCode);
      if (cs) {
        const isAdmin = client.playerId === cs.adminId;
        if (isAdmin) {
          sendTo(ws, {
            type: "gtcState",
            payload: {
              isAdmin: true, answer: cs.answer, hints: cs.hints,
              currentHintIndex: cs.currentHintIndex, answerRevealed: cs.answerRevealed,
              adminId: cs.adminId, totalHints: cs.hints.length,
            },
          });
        } else {
          const currentHint = cs.currentHintIndex >= 0 ? cs.hints[cs.currentHintIndex] : null;
          sendTo(ws, {
            type: "gtcState",
            payload: {
              isAdmin: false, currentHint, currentHintIndex: cs.currentHintIndex,
              answerRevealed: cs.answerRevealed,
              revealedAnswer: cs.answerRevealed ? cs.answer : undefined,
              adminId: cs.adminId,
            },
          });
        }
      }
    }

    // Resend charades state if in progress
    if (state?.status === "charades_playing" && client.playerId) {
      const cs = roomCharadesState.get(roomCode);
      if (cs) {
        const isHost = client.playerId === cs.hostId;
        const performerId = cs.playerQueue[cs.currentPerformerIdx] ?? null;
        const isPerformer = client.playerId === performerId;
        const nextPerformerIdx = (cs.currentPerformerIdx + 1) % cs.playerQueue.length;
        const nextPerformerId = cs.playerQueue[nextPerformerIdx];
        // Get names from the just-fetched state
        const pList = state.players;
        const performer = pList.find((p) => p.id === performerId);
        const nextPerformer = pList.find((p) => p.id === nextPerformerId);
        sendTo(ws, {
          type: "charadesState",
          payload: {
            isHost,
            isPerformer,
            hostId: cs.hostId,
            performerName: performer?.name ?? "",
            performerId,
            nextPerformerName: nextPerformer?.name ?? "",
            wordNumber: cs.wordNumber,
            totalWords: cs.words.length,
            word: isPerformer ? cs.currentWord : undefined,
          },
        });
      }
    }

    broadcast(roomCode, { type: "roomUpdate", payload: state });
    return;
  }

  if (!client.roomCode) return;

  // ── FOREHEAD: SET CATEGORY ────────────────────────────────────────────────
  if (type === "setCategory") {
    const { roomCode, categoryId, supabaseCategory, supabaseTable } = payload as {
      roomCode: string; categoryId: number; supabaseCategory?: string; supabaseTable?: string;
    };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;
    if (supabaseCategory && supabaseTable) {
      roomSupabaseCategory.set(roomCode, { table: supabaseTable, category: supabaseCategory });
      await db.update(roomsTable).set({ categoryId: null }).where(eq(roomsTable.code, roomCode));
    } else {
      roomSupabaseCategory.delete(roomCode);
      await db.update(roomsTable).set({ categoryId: Number(categoryId) }).where(eq(roomsTable.code, roomCode));
    }
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── FOREHEAD: START GAME ─────────────────────────────────────────────────
  if (type === "startGame") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "waiting") return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;
    if (!room.categoryId && !roomSupabaseCategory.has(roomCode)) {
      sendTo(ws, { type: "error", payload: { message: "Please select a category first" } });
      return;
    }
    const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
    const connected = players.filter((p) => p.connected);
    if (connected.length < 2) {
      sendTo(ws, { type: "error", payload: { message: "Need at least 2 players to start" } });
      return;
    }
    roomRoundState.delete(roomCode);
    await startCountdown(roomCode);
    return;
  }

  // ── FOREHEAD: END ROUND ───────────────────────────────────────────────────
  if (type === "endRound") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "word_display") return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    await db.update(roomsTable).set({ status: "reveal" }).where(eq(roomsTable.code, roomCode));

    const rs = roomRoundState.get(roomCode);
    if (!rs) return;

    for (const [ws2, c] of clients.entries()) {
      if (c.roomCode === roomCode && ws2.readyState === WebSocket.OPEN && c.playerId) {
        const isImposter = c.playerId === rs.imposterId;
        const myWord = rs.playerWords?.[c.playerId] ?? (isImposter ? rs.imposterWord : rs.normalWord);
        sendTo(ws2, {
          type: "revealInfo",
          payload: {
            myWord, isImposter, imposterName: rs.imposterName,
            normalWord: rs.normalWord, imposterWord: rs.imposterWord,
            categoryName: rs.categoryName, roundNumber: rs.roundNumber,
            readyPlayerIds: rs.readyPlayerIds,
          },
        });
      }
    }

    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── FOREHEAD: REGEN ONE PLAYER'S WORD ────────────────────────────────────
  if (type === "regenPlayerWord") {
    const { roomCode, targetPlayerId } = payload as { roomCode: string; targetPlayerId: number };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    const supabaseCat = roomSupabaseCategory.get(roomCode);
    if (!room || room.status !== "word_display" || (!room.categoryId && !supabaseCat)) return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    const rs = roomRoundState.get(roomCode);
    if (!rs) return;

    const usedWords = new Set(
      Object.entries(rs.playerWords)
        .filter(([id]) => Number(id) !== targetPlayerId)
        .map(([, word]) => word)
    );
    let available: string[];
    if (supabaseCat) {
      const result = await fetchForeheadWordsFromSupabase(supabaseCat.table, supabaseCat.category);
      if (result.error || result.words.length === 0) return;
      available = result.words.filter((w) => !usedWords.has(w));
    } else {
      const items = await db.select().from(categoryItemsTable).where(eq(categoryItemsTable.categoryId, room.categoryId!));
      available = items.filter((item) => !usedWords.has(item.itemText)).map((i) => i.itemText);
    }
    if (available.length === 0) return;

    const newWord = available[Math.floor(Math.random() * available.length)];
    rs.playerWords[targetPlayerId] = newWord;

    // Keep normalWord / imposterWord in sync
    if (targetPlayerId === rs.imposterId) {
      rs.imposterWord = newWord;
    } else {
      const normalWords = Object.entries(rs.playerWords)
        .filter(([id]) => Number(id) !== rs.imposterId)
        .map(([, w]) => w);
      if (normalWords.length > 0) rs.normalWord = normalWords[0];
    }

    const regenCatName = supabaseCat?.category ?? rs.categoryName;
    const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
    const connected = players.filter((p) => p.connected);

    for (const [ws2, c] of clients.entries()) {
      if (c.roomCode !== roomCode || ws2.readyState !== WebSocket.OPEN || !c.playerId) continue;
      const allPlayerWords = connected.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        word: p.id === c.playerId ? "???" : (rs.playerWords[p.id] ?? "???"),
      }));
      sendTo(ws2, {
        type: "roundStart",
        payload: {
          roundNumber: rs.roundNumber,
          myWord: rs.playerWords[c.playerId] ?? "???",
          isImposter: c.playerId === rs.imposterId,
          categoryName: regenCatName,
          allPlayerWords,
        },
      });
    }
    return;
  }

  // ── FOREHEAD: NEW WORD (re-deal immediately, no countdown) ───────────────
  if (type === "newWord") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "word_display") return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;
    await beginWordDisplay(roomCode);
    return;
  }

  // ── FOREHEAD: PLAYER READY ────────────────────────────────────────────────
  if (type === "playerReady") {
    const { roomCode } = payload as { roomCode: string };
    const rs = roomRoundState.get(roomCode);
    if (!rs || !client.playerId) return;
    if (!rs.readyPlayerIds.includes(client.playerId)) rs.readyPlayerIds.push(client.playerId);
    broadcast(roomCode, { type: "readyUpdate", payload: { readyPlayerIds: rs.readyPlayerIds } });
    return;
  }

  // ── FOREHEAD: NEXT ROUND ──────────────────────────────────────────────────
  if (type === "nextRound") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "reveal") return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
    const connected = players.filter((p) => p.connected);
    const rs = roomRoundState.get(roomCode);
    const readyIds = rs?.readyPlayerIds ?? [];
    const allReady = connected.every((p) => readyIds.includes(p.id));
    if (!allReady) {
      sendTo(ws, { type: "error", payload: { message: "Not all players are ready yet" } });
      return;
    }

    await startCountdown(roomCode);
    return;
  }

  // ── FOREHEAD: END GAME ────────────────────────────────────────────────────
  if (type === "endGame") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    clearRoomTimer(roomCode);
    roomRoundState.delete(roomCode);
    await db.update(roomsTable).set({ status: "finished" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "gameEnd", payload: {} });
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── FOREHEAD: PLAY AGAIN ──────────────────────────────────────────────────
  if (type === "playAgain") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    clearRoomTimer(roomCode);
    roomRoundState.delete(roomCode);
    await db.update(roomsTable).set({ status: "waiting" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── CHARACTER: START GAME ─────────────────────────────────────────────────
  if (type === "gtcStart") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "waiting" || room.mode !== "character") return;

    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    const lang = room.lang ?? "en";
    const picked = await pickNextCharacter(lang, undefined);
    if (!picked) {
      sendTo(ws, { type: "error", payload: { message: "No characters found for this language." } });
      return;
    }

    const cs: CharacterRoundState = {
      adminId: client.playerId!,
      answer: picked.entry.answer,
      hints: picked.entry.hints,
      currentHintIndex: -1,
      answerRevealed: false,
      usedPoolIndices: [picked.entry.id],
      lang,
      playerGuesses: [],
      guessCountByPlayer: {},
      lastGuessByPlayer: {},
    };
    roomCharacterState.set(roomCode, cs);

    await db.update(roomsTable).set({ status: "character_playing" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    await broadcastCharacterState(roomCode);
    return;
  }

  // ── CHARACTER: NEXT HINT ──────────────────────────────────────────────────
  if (type === "gtcNextHint") {
    const { roomCode } = payload as { roomCode: string };
    const cs = roomCharacterState.get(roomCode);
    if (!cs || cs.adminId !== client.playerId) return;
    if (cs.currentHintIndex >= cs.hints.length - 1) return; // all hints shown

    cs.currentHintIndex++;
    await broadcastCharacterState(roomCode);
    return;
  }

  // ── CHARACTER: REVEAL ANSWER ──────────────────────────────────────────────
  if (type === "gtcRevealAnswer") {
    const { roomCode } = payload as { roomCode: string };
    const cs = roomCharacterState.get(roomCode);
    if (!cs || cs.adminId !== client.playerId) return;

    cs.answerRevealed = true;
    await broadcastCharacterState(roomCode);
    return;
  }

  // ── CHARACTER: NEXT CHARACTER ─────────────────────────────────────────────
  if (type === "gtcNextCharacter") {
    const { roomCode } = payload as { roomCode: string };
    const cs = roomCharacterState.get(roomCode);
    if (!cs || cs.adminId !== client.playerId) return;

    const picked = await pickNextCharacter(cs.lang, cs);
    if (!picked) {
      sendTo(ws, { type: "error", payload: { message: "No characters found for this language." } });
      return;
    }

    const updatedUsed = cs.usedPoolIndices.includes(picked.entry.id)
      ? [picked.entry.id] // reset happened — start fresh
      : [...cs.usedPoolIndices, picked.entry.id];

    const newCs: CharacterRoundState = {
      adminId: cs.adminId,
      answer: picked.entry.answer,
      hints: picked.entry.hints,
      currentHintIndex: -1,
      answerRevealed: false,
      usedPoolIndices: updatedUsed,
      lang: cs.lang,
      playerGuesses: [],
      guessCountByPlayer: {},
      lastGuessByPlayer: {},
    };
    roomCharacterState.set(roomCode, newCs);
    await broadcastCharacterState(roomCode);
    return;
  }

  // ── CHARACTER: SUBMIT GUESS ───────────────────────────────────────────────
  if (type === "gtcSubmitGuess") {
    const { roomCode, guess } = payload as { roomCode: string; guess: string };
    const cs = roomCharacterState.get(roomCode);
    if (!cs || !client.playerId) return;
    if (cs.adminId === client.playerId) return; // admin cannot guess

    const currentCount = cs.guessCountByPlayer[client.playerId] ?? 0;
    if (currentCount >= 3) return; // max 3 guesses

    // Penalty: player already guessed on this hint — must wait for next
    const lastHint = cs.lastGuessByPlayer[client.playerId] ?? -99;
    if (lastHint === cs.currentHintIndex) return;

    const trimmedGuess = String(guess).trim().slice(0, 100);
    if (!trimmedGuess) return;

    const guessNumber = currentCount + 1;
    cs.guessCountByPlayer[client.playerId] = guessNumber;
    cs.lastGuessByPlayer[client.playerId] = cs.currentHintIndex;
    cs.playerGuesses.push({
      playerId: client.playerId,
      playerName: client.playerName ?? "Unknown",
      guess: trimmedGuess,
      guessNumber,
    });

    await broadcastCharacterState(roomCode);
    return;
  }

  // ── CHARACTER: CROWN WINNER ───────────────────────────────────────────────
  if (type === "gtcCrownWinner") {
    const { roomCode, playerId: winnerId } = payload as { roomCode: string; playerId: number };
    const cs = roomCharacterState.get(roomCode);
    if (!cs || cs.adminId !== client.playerId) return;

    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const winner = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.id, Number(winnerId))),
    });
    if (!winner) return;

    await db.update(playersTable).set({ score: winner.score + 1 }).where(eq(playersTable.id, winner.id));
    broadcast(roomCode, { type: "gtcWinner", payload: { winnerId: winner.id, winnerName: winner.name } });
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── CHARACTER: TRANSFER ADMIN ─────────────────────────────────────────────
  if (type === "gtcTransferAdmin") {
    const { roomCode, targetPlayerId } = payload as { roomCode: string; targetPlayerId: number };
    const cs = roomCharacterState.get(roomCode);
    if (!cs || cs.adminId !== client.playerId) return;

    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;

    const target = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.id, Number(targetPlayerId))),
    });
    if (!target || !target.connected) {
      sendTo(ws, { type: "error", payload: { message: "Player not found or not connected." } });
      return;
    }

    cs.adminId = Number(targetPlayerId);
    await broadcastCharacterState(roomCode);
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── CHARACTER: END GAME ───────────────────────────────────────────────────
  if (type === "gtcEndGame") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const cs = roomCharacterState.get(roomCode);
    if (!cs || cs.adminId !== client.playerId) return;

    roomCharacterState.delete(roomCode);
    await db.update(roomsTable).set({ status: "finished" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "gameEnd", payload: {} });
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── CHARACTER: BACK TO LOBBY ──────────────────────────────────────────────
  if (type === "gtcBackToLobby") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const cs = roomCharacterState.get(roomCode);
    // Allow host OR game admin to go back to lobby
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (cs?.adminId !== client.playerId && host?.id !== client.playerId) return;

    roomCharacterState.delete(roomCode);
    await db.update(roomsTable).set({ status: "waiting" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── CHARADES: START GAME ──────────────────────────────────────────────────
  if (type === "charadesStart") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "waiting" || room.mode !== "charades") return;

    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    const lang = room.lang ?? "en";
    const pool = await getCharadesPool(lang);
    if (pool.length === 0) {
      sendTo(ws, { type: "error", payload: { message: "No charades words loaded for this language. Please upload words from the admin panel first." } });
      return;
    }

    const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
    const connected = players.filter((p) => p.connected);
    if (connected.length < 2) {
      sendTo(ws, { type: "error", payload: { message: "Need at least 2 players to start." } });
      return;
    }

    const playerQueue = [...connected].sort(() => Math.random() - 0.5).map((p) => p.id);
    const wordEntry = pool[Math.floor(Math.random() * pool.length)];

    const cs: CharadesRoundState = {
      hostId: host.id,
      words: pool,
      usedWordIds: [wordEntry.id],
      currentWord: wordEntry.answer,
      currentWordId: wordEntry.id,
      currentPerformerIdx: 0,
      playerQueue,
      wordNumber: 1,
      lang,
    };
    roomCharadesState.set(roomCode, cs);

    await db.update(roomsTable).set({ status: "charades_playing" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    await broadcastCharadesState(roomCode);
    return;
  }

  // ── CHARADES: NEXT PLAYER ─────────────────────────────────────────────────
  if (type === "charadesNext") {
    const { roomCode } = payload as { roomCode: string };
    const cs = roomCharadesState.get(roomCode);
    if (!cs || cs.hostId !== client.playerId) return;

    cs.currentPerformerIdx = (cs.currentPerformerIdx + 1) % cs.playerQueue.length;

    let available = cs.words.filter((w) => !cs.usedWordIds.includes(w.id));
    if (available.length === 0) {
      cs.usedWordIds = [];
      available = cs.words;
    }
    const nextWord = available[Math.floor(Math.random() * available.length)];
    cs.currentWord = nextWord.answer;
    cs.currentWordId = nextWord.id;
    cs.usedWordIds.push(nextWord.id);
    cs.wordNumber++;

    await broadcastCharadesState(roomCode);
    return;
  }

  // ── CHARADES: END GAME ────────────────────────────────────────────────────
  if (type === "charadesEndGame") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const cs = roomCharadesState.get(roomCode);
    if (!cs || cs.hostId !== client.playerId) return;

    roomCharadesState.delete(roomCode);
    await db.update(roomsTable).set({ status: "finished" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "gameEnd", payload: {} });
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── CHARADES: BACK TO LOBBY ───────────────────────────────────────────────
  if (type === "charadesBackToLobby") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const cs = roomCharadesState.get(roomCode);
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (cs?.hostId !== client.playerId && host?.id !== client.playerId) return;

    roomCharadesState.delete(roomCode);
    await db.update(roomsTable).set({ status: "waiting" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── DYKM: START GAME ──────────────────────────────────────────────────────
  if (type === "dykmStart") {
    const { roomCode, targetScore, askerId } = payload as { roomCode: string; targetScore: number; askerId: number };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.mode !== "dykm" || room.status !== "waiting") return;
    const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
    const host = players.find(p => p.id === client.playerId && p.isHost);
    if (!host) return;
    const ts = Number(targetScore) === 10 ? 10 : 3;
    const asker = players.find(p => p.id === Number(askerId)) || host;
    const scores: Record<number, number> = {};
    for (const p of players) scores[p.id] = 0;
    const ds: DykmGameState = { hostId: client.playerId!, askerId: asker.id, askerName: asker.name, targetScore: ts, scores, status: 'playing', lang: room.lang };
    roomDykmState.set(roomCode, ds);
    await db.update(roomsTable).set({ status: "dykm_playing" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    await broadcastDykmState(roomCode);
    return;
  }

  // ── DYKM: SET ASKER ───────────────────────────────────────────────────────
  if (type === "dykmSetAsker") {
    const { roomCode, askerId } = payload as { roomCode: string; askerId: number };
    const ds = roomDykmState.get(roomCode);
    if (!ds) return;
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
    const asker = players.find(p => p.id === Number(askerId));
    if (!asker) return;
    ds.askerId = asker.id;
    ds.askerName = asker.name;
    ds.selectedQuestion = undefined;
    await broadcastDykmState(roomCode);
    return;
  }

  // ── DYKM: SELECT QUESTION ─────────────────────────────────────────────────
  if (type === "dykmSelectQuestion") {
    const { roomCode: rc, question } = payload as { roomCode: string; question: { id: number; question: string; categoryName: string } };
    const ds = roomDykmState.get(rc);
    if (!ds) return;
    if (ds.askerId !== client.playerId) return;
    ds.selectedQuestion = question;
    await broadcastDykmState(rc);
    return;
  }

  // ── DYKM: AWARD POINT ─────────────────────────────────────────────────────
  if (type === "dykmAwardPoint") {
    const { roomCode, toPlayerId } = payload as { roomCode: string; toPlayerId: number };
    const ds = roomDykmState.get(roomCode);
    if (!ds || ds.status === 'finished') return;
    if (ds.askerId !== client.playerId) return;
    const pid = Number(toPlayerId);
    if (!(pid in ds.scores)) return;
    ds.scores[pid] = (ds.scores[pid] ?? 0) + 1;
    ds.lastPointTo = pid;
    if (ds.scores[pid] >= ds.targetScore) {
      ds.status = 'finished';
      const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
      if (room) {
        const winner = await db.query.playersTable.findFirst({ where: and(eq(playersTable.roomId, room.id), eq(playersTable.id, pid)) });
        if (winner) { ds.winnerId = winner.id; ds.winnerName = winner.name; }
        await db.update(roomsTable).set({ status: "finished" }).where(eq(roomsTable.code, roomCode));
        broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
      }
    }
    await broadcastDykmState(roomCode);
    return;
  }

  // ── DYKM: UNDO POINT ──────────────────────────────────────────────────────
  if (type === "dykmUndoPoint") {
    const { roomCode, toPlayerId } = payload as { roomCode: string; toPlayerId: number };
    const ds = roomDykmState.get(roomCode);
    if (!ds || ds.askerId !== client.playerId) return;
    const pid = Number(toPlayerId);
    if (!(pid in ds.scores)) return;
    ds.scores[pid] = Math.max(0, (ds.scores[pid] ?? 0) - 1);
    ds.lastPointTo = undefined;
    if (ds.status === 'finished') {
      ds.status = 'playing'; ds.winnerId = undefined; ds.winnerName = undefined;
      await db.update(roomsTable).set({ status: "dykm_playing" }).where(eq(roomsTable.code, roomCode));
      broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    }
    await broadcastDykmState(roomCode);
    return;
  }

  // ── DYKM: END GAME ────────────────────────────────────────────────────────
  if (type === "dykmEndGame") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({ where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)) });
    if (host?.id !== client.playerId) return;
    roomDykmState.delete(roomCode);
    await db.update(roomsTable).set({ status: "finished" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "gameEnd", payload: {} });
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── DYKM: BACK TO LOBBY ───────────────────────────────────────────────────
  if (type === "dykmBackToLobby") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({ where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)) });
    if (host?.id !== client.playerId) return;
    roomDykmState.delete(roomCode);
    await db.update(roomsTable).set({ status: "waiting" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }
}

// ── WS SERVER SETUP ───────────────────────────────────────────────────────────

export function setupWebSocketServer(server: import("http").Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    const client: WsClient = { ws, roomCode: null, playerId: null, playerName: null };
    clients.set(ws, client);

    ws.on("message", (data) => {
      handleMessage(ws, client, data.toString()).catch((err) => {
        logger.error({ err }, "WS message handler error");
      });
    });

    ws.on("close", async () => {
      if (client.playerId && client.roomCode) {
        try {
          await db.update(playersTable).set({ connected: false }).where(eq(playersTable.id, client.playerId));
          const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, client.playerId) });
          if (player?.isHost) {
            const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, client.roomCode) });
            if (room) {
              const others = await db.select().from(playersTable).where(
                and(eq(playersTable.roomId, room.id), eq(playersTable.connected, true))
              );
              if (others.length > 0) {
                await db.update(playersTable).set({ isHost: false }).where(eq(playersTable.roomId, room.id));
                await db.update(playersTable).set({ isHost: true }).where(eq(playersTable.id, others[0].id));
              }
            }
          }

          // If the departing player was the character game admin, transfer to another connected player
          if (client.roomCode) {
            const cs = roomCharacterState.get(client.roomCode);
            if (cs && cs.adminId === client.playerId) {
              const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, client.roomCode) });
              if (room) {
                const others = await db.select().from(playersTable).where(
                  and(eq(playersTable.roomId, room.id), eq(playersTable.connected, true))
                );
                if (others.length > 0) {
                  cs.adminId = others[0].id;
                  await broadcastCharacterState(client.roomCode);
                }
              }
            }
          }

          // If the departing player was the charades host, transfer to the new host
          if (client.roomCode) {
            const crs = roomCharadesState.get(client.roomCode);
            if (crs && crs.hostId === client.playerId) {
              const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, client.roomCode) });
              if (room) {
                const others = await db.select().from(playersTable).where(
                  and(eq(playersTable.roomId, room.id), eq(playersTable.connected, true))
                );
                if (others.length > 0) {
                  crs.hostId = others[0].id;
                  await broadcastCharadesState(client.roomCode);
                }
              }
            }
          }

          const state = await getRoomState(client.roomCode);
          if (state) broadcast(client.roomCode, { type: "roomUpdate", payload: state });
        } catch (err) {
          logger.error({ err }, "Error handling WS close");
        }
      }
      clients.delete(ws);
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WS error");
    });
  });

  logger.info("WebSocket server ready at /ws");
  return wss;
}

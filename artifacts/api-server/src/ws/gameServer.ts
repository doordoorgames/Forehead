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

interface WsClient {
  ws: WebSocket;
  roomCode: string | null;
  playerId: number | null;
  playerName: string | null;
}

interface RoundState {
  roundNumber: number;
  imposterId: number;
  imposterName: string;
  normalWord: string;
  imposterWord: string;
  categoryName: string;
  readyPlayerIds: number[];
}

const clients = new Map<WebSocket, WsClient>();
const roomTimers = new Map<string, ReturnType<typeof setInterval>>();
const roomRoundState = new Map<string, RoundState>();

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
  if (room.categoryId) {
    const cat = await db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, room.categoryId) });
    categoryName = cat?.name ?? null;
  }
  return {
    code: room.code,
    status: room.status,
    categoryId: room.categoryId ?? null,
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
  if (!room || !room.categoryId) return;

  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
  const connected = players.filter((p) => p.connected);
  if (connected.length < 2) return;

  const items = await db.select().from(categoryItemsTable).where(eq(categoryItemsTable.categoryId, room.categoryId));
  if (items.length < 2) {
    broadcast(roomCode, { type: "error", payload: { message: "Need at least 2 items in category" } });
    return;
  }

  const cat = await db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, room.categoryId) });

  // Pick two distinct items for normal word and imposter word
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const normalItem = shuffled[0];
  const imposterItem = shuffled[1];

  // Pick random imposter player
  const imposterPlayer = connected[Math.floor(Math.random() * connected.length)];

  const existingRound = roomRoundState.get(roomCode);
  const roundNumber = (existingRound?.roundNumber ?? 0) + 1;

  const roundState: RoundState = {
    roundNumber,
    imposterId: imposterPlayer.id,
    imposterName: imposterPlayer.name,
    normalWord: normalItem.itemText,
    imposterWord: imposterItem.itemText,
    categoryName: cat?.name ?? "Unknown",
    readyPlayerIds: [],
  };
  roomRoundState.set(roomCode, roundState);

  await db.update(roomsTable).set({ status: "word_display" }).where(eq(roomsTable.code, roomCode));

  // Send personalized roundStart to each player
  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === roomCode && ws.readyState === WebSocket.OPEN && client.playerId) {
      const isImposter = client.playerId === imposterPlayer.id;
      sendTo(ws, {
        type: "roundStart",
        payload: {
          roundNumber,
          myWord: isImposter ? imposterItem.itemText : normalItem.itemText,
          isImposter,
          categoryName: cat?.name ?? "Unknown",
        },
      });
    }
  }

  broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
}

async function handleMessage(ws: WebSocket, client: WsClient, raw: string) {
  let msg: { type: string; payload: Record<string, unknown> };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  const { type, payload } = msg;

  // ── JOIN ──
  if (type === "join") {
    const { roomCode, playerId, playerName } = payload as { roomCode: string; playerId: number; playerName: string };
    client.roomCode = roomCode;
    client.playerId = Number(playerId);
    client.playerName = playerName;

    await db.update(playersTable).set({ connected: true }).where(eq(playersTable.id, Number(playerId)));

    const state = await getRoomState(roomCode);
    if (state) sendTo(ws, { type: "roomUpdate", payload: state });

    // If in word_display, resend their word
    const rs = roomRoundState.get(roomCode);
    if (rs && state?.status === "word_display") {
      const isImposter = client.playerId === rs.imposterId;
      sendTo(ws, {
        type: "roundStart",
        payload: {
          roundNumber: rs.roundNumber,
          myWord: isImposter ? rs.imposterWord : rs.normalWord,
          isImposter,
          categoryName: rs.categoryName,
        },
      });
    }

    // If in reveal, resend reveal info
    if (rs && state?.status === "reveal") {
      const isImposter = client.playerId === rs.imposterId;
      sendTo(ws, {
        type: "revealInfo",
        payload: {
          myWord: isImposter ? rs.imposterWord : rs.normalWord,
          isImposter,
          imposterName: rs.imposterName,
          normalWord: rs.normalWord,
          imposterWord: rs.imposterWord,
          categoryName: rs.categoryName,
          roundNumber: rs.roundNumber,
          readyPlayerIds: rs.readyPlayerIds,
        },
      });
    }

    broadcast(roomCode, { type: "roomUpdate", payload: state });
    return;
  }

  if (!client.roomCode) return;

  // ── SET CATEGORY ──
  if (type === "setCategory") {
    const { roomCode, categoryId } = payload as { roomCode: string; categoryId: number };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;
    await db.update(roomsTable).set({ categoryId: Number(categoryId) }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── START GAME ──
  if (type === "startGame") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "waiting") return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;
    if (!room.categoryId) {
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

  // ── END ROUND (admin triggers reveal) ──
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

    // Send personalized reveal to each player
    for (const [ws2, c] of clients.entries()) {
      if (c.roomCode === roomCode && ws2.readyState === WebSocket.OPEN && c.playerId) {
        const isImposter = c.playerId === rs.imposterId;
        sendTo(ws2, {
          type: "revealInfo",
          payload: {
            myWord: isImposter ? rs.imposterWord : rs.normalWord,
            isImposter,
            imposterName: rs.imposterName,
            normalWord: rs.normalWord,
            imposterWord: rs.imposterWord,
            categoryName: rs.categoryName,
            roundNumber: rs.roundNumber,
            readyPlayerIds: rs.readyPlayerIds,
          },
        });
      }
    }

    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  // ── PLAYER READY ──
  if (type === "playerReady") {
    const { roomCode } = payload as { roomCode: string };
    const rs = roomRoundState.get(roomCode);
    if (!rs || !client.playerId) return;

    if (!rs.readyPlayerIds.includes(client.playerId)) {
      rs.readyPlayerIds.push(client.playerId);
    }

    broadcast(roomCode, {
      type: "readyUpdate",
      payload: { readyPlayerIds: rs.readyPlayerIds },
    });
    return;
  }

  // ── NEXT ROUND (admin) ──
  if (type === "nextRound") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room || room.status !== "reveal") return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    // Require all connected players to be ready
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

  // ── END GAME (admin) ──
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

  // ── PLAY AGAIN (reset to lobby) ──
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
}

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

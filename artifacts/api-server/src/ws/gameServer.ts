import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import {
  roomsTable,
  playersTable,
  categoryItemsTable,
  turnsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

interface WsClient {
  ws: WebSocket;
  roomCode: string | null;
  playerId: number | null;
  playerName: string | null;
}

interface GameTimer {
  interval: NodeJS.Timeout;
  secondsLeft: number;
}

const clients = new Map<WebSocket, WsClient>();
const roomTimers = new Map<string, GameTimer>();
const roomTurnState = new Map<string, {
  currentPlayerId: number;
  currentPlayerName: string;
  turnNumber: number;
  totalTurns: number;
  itemText: string;
  imageUrl: string | null;
  turnId: number;
  usedItemIds: number[];
}>();

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
    turnDuration: room.turnDuration,
    roundCount: room.roundCount,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score,
      connected: p.connected,
    })),
  };
}

async function broadcastRoomUpdate(code: string) {
  const state = await getRoomState(code);
  if (!state) return;
  broadcast(code, { type: "roomUpdate", payload: state });
}

function clearRoomTimer(code: string) {
  const t = roomTimers.get(code);
  if (t) {
    clearInterval(t.interval);
    roomTimers.delete(code);
  }
}

async function endTurn(code: string, result: "correct" | "pass" | "timeout") {
  clearRoomTimer(code);
  const turnState = roomTurnState.get(code);
  if (!turnState) return;

  // Record turn result
  await db.update(turnsTable)
    .set({ result, endedAt: new Date() })
    .where(eq(turnsTable.id, turnState.turnId));

  if (result === "correct") {
    await db.update(playersTable)
      .set({ score: sql`${playersTable.score} + 1` })
      .where(eq(playersTable.id, turnState.currentPlayerId));
  }

  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, code) });
  if (!room) return;
  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
  const connectedPlayers = players.filter((p) => p.connected);

  // Check if all turns done
  const newTurnNumber = turnState.turnNumber + 1;
  const totalTurns = connectedPlayers.length * room.roundCount;

  if (newTurnNumber >= totalTurns) {
    // Game over
    await db.update(roomsTable).set({ status: "finished" }).where(eq(roomsTable.code, code));
    roomTurnState.delete(code);

    const updatedPlayers = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
    const sorted = [...updatedPlayers].sort((a, b) => b.score - a.score);
    broadcast(code, {
      type: "gameEnd",
      payload: {
        players: sorted.map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          correctGuesses: p.score,
          turnsPlayed: room.roundCount,
        })),
        totalTurns: newTurnNumber,
        winnerId: sorted[0]?.id ?? null,
      },
    });
    return;
  }

  // Next player
  const currentIdx = connectedPlayers.findIndex((p) => p.id === turnState.currentPlayerId);
  const nextIdx = (currentIdx + 1) % connectedPlayers.length;
  const nextPlayer = connectedPlayers[nextIdx];

  broadcast(code, {
    type: "turnEnd",
    payload: { result, nextPlayerId: nextPlayer.id },
  });

  // Start next turn after a short delay
  setTimeout(() => startTurn(code, nextPlayer.id, nextPlayer.name, newTurnNumber, turnState.usedItemIds), 2000);
}

async function startTurn(
  code: string,
  playerId: number,
  playerName: string,
  turnNumber: number,
  usedItemIds: number[]
) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, code) });
  if (!room || room.status !== "playing") return;

  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, room.id));
  const connectedPlayers = players.filter((p) => p.connected);
  const totalTurns = connectedPlayers.length * room.roundCount;

  // Pick an item not yet used
  let items = await db.select().from(categoryItemsTable).where(eq(categoryItemsTable.categoryId, room.categoryId!));
  const unusedItems = items.filter((i) => !usedItemIds.includes(i.id));
  // If all items used, allow repeats but avoid the last used
  const pool = unusedItems.length > 0 ? unusedItems : items;
  const item = pool[Math.floor(Math.random() * pool.length)];
  if (!item) {
    logger.warn({ code }, "No items in category");
    return;
  }

  const newUsedItemIds = [...usedItemIds, item.id];

  // Create turn record
  const [turn] = await db.insert(turnsTable).values({
    roomId: room.id,
    playerId,
    itemId: item.id,
    itemText: item.itemText,
    imageUrl: item.imageUrl ?? null,
    turnNumber,
  }).returning();

  roomTurnState.set(code, {
    currentPlayerId: playerId,
    currentPlayerName: playerName,
    turnNumber,
    totalTurns,
    itemText: item.itemText,
    imageUrl: item.imageUrl ?? null,
    turnId: turn.id,
    usedItemIds: newUsedItemIds,
  });

  // Send gameStarted/turnUpdate with assignment only to the current player
  const turnPayload = {
    currentPlayerId: playerId,
    currentPlayerName: playerName,
    turnNumber,
    totalTurns,
    assignment: null as { itemText: string; imageUrl: string | null } | null,
    secondsLeft: room.turnDuration,
  };

  // Broadcast to everyone except the current player (without assignment)
  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === code && ws.readyState === WebSocket.OPEN) {
      if (client.playerId === playerId) {
        // The guesser: DON'T show them the assignment
        sendTo(ws, { type: "turnUpdate", payload: { ...turnPayload, assignment: null } });
      } else {
        // Others: show the assignment
        sendTo(ws, {
          type: "turnUpdate",
          payload: {
            ...turnPayload,
            assignment: { itemText: item.itemText, imageUrl: item.imageUrl ?? null },
          },
        });
      }
    }
  }

  // Start countdown timer
  let secondsLeft = room.turnDuration;
  const interval = setInterval(async () => {
    secondsLeft--;
    const timer = roomTimers.get(code);
    if (timer) timer.secondsLeft = secondsLeft;

    broadcast(code, { type: "timerTick", payload: { secondsLeft } });

    if (secondsLeft <= 0) {
      await endTurn(code, "timeout");
    }
  }, 1000);

  roomTimers.set(code, { interval, secondsLeft });
}

async function handleMessage(ws: WebSocket, client: WsClient, raw: string) {
  let msg: { type: string; payload: Record<string, unknown> };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  const { type, payload } = msg;

  if (type === "join") {
    const { roomCode, playerId, playerName } = payload as { roomCode: string; playerId: number; playerName: string };
    client.roomCode = roomCode;
    client.playerId = Number(playerId);
    client.playerName = playerName;

    // Mark player as connected
    await db.update(playersTable).set({ connected: true }).where(eq(playersTable.id, Number(playerId)));

    // Send current state
    const state = await getRoomState(roomCode);
    if (state) {
      sendTo(ws, { type: "roomUpdate", payload: state });
    }

    // If game is playing, send current turn state
    const ts = roomTurnState.get(roomCode);
    if (ts && state?.status === "playing") {
      const timer = roomTimers.get(roomCode);
      const secondsLeft = timer?.secondsLeft ?? 0;
      if (client.playerId === ts.currentPlayerId) {
        sendTo(ws, { type: "turnUpdate", payload: { ...ts, assignment: null, secondsLeft } });
      } else {
        sendTo(ws, {
          type: "turnUpdate",
          payload: {
            ...ts,
            assignment: { itemText: ts.itemText, imageUrl: ts.imageUrl },
            secondsLeft,
          },
        });
      }
    }

    // Broadcast join
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  if (!client.roomCode) return;

  if (type === "setCategory") {
    const { roomCode, categoryId } = payload as { roomCode: string; categoryId: number };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    // Only host can change category
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    await db.update(roomsTable).set({ categoryId: Number(categoryId) }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }

  if (type === "setOptions") {
    const { roomCode, turnDuration, roundCount } = payload as { roomCode: string; turnDuration?: number; roundCount?: number };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    const updates: Record<string, unknown> = {};
    if (turnDuration) updates.turnDuration = Number(turnDuration);
    if (roundCount) updates.roundCount = Number(roundCount);
    if (Object.keys(updates).length > 0) {
      await db.update(roomsTable).set(updates).where(eq(roomsTable.code, roomCode));
      broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    }
    return;
  }

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
      sendTo(ws, { type: "error", payload: { message: "Need at least 2 players" } });
      return;
    }

    // Reset scores
    for (const p of players) {
      await db.update(playersTable).set({ score: 0 }).where(eq(playersTable.id, p.id));
    }

    await db.update(roomsTable).set({ status: "playing" }).where(eq(roomsTable.code, roomCode));
    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });

    // Start first turn
    const firstPlayer = connected[0];
    await startTurn(roomCode, firstPlayer.id, firstPlayer.name, 0, []);
    return;
  }

  if (type === "correct") {
    const { roomCode } = payload as { roomCode: string };
    const ts = roomTurnState.get(roomCode);
    if (!ts || client.playerId !== ts.currentPlayerId) return;
    await endTurn(roomCode, "correct");
    return;
  }

  if (type === "pass") {
    const { roomCode } = payload as { roomCode: string };
    const ts = roomTurnState.get(roomCode);
    if (!ts || client.playerId !== ts.currentPlayerId) return;
    await endTurn(roomCode, "pass");
    return;
  }

  if (type === "playAgain") {
    const { roomCode } = payload as { roomCode: string };
    const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, roomCode) });
    if (!room) return;
    const host = await db.query.playersTable.findFirst({
      where: and(eq(playersTable.roomId, room.id), eq(playersTable.isHost, true)),
    });
    if (host?.id !== client.playerId) return;

    clearRoomTimer(roomCode);
    roomTurnState.delete(roomCode);

    // Reset room to waiting
    await db.update(roomsTable).set({ status: "waiting" }).where(eq(roomsTable.code, roomCode));
    await db.update(playersTable).set({ score: 0 }).where(eq(playersTable.roomId, room.id));

    broadcast(roomCode, { type: "roomUpdate", payload: await getRoomState(roomCode) });
    return;
  }
}

export function setupWebSocketServer(server: import("http").Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    const client: WsClient = {
      ws,
      roomCode: null,
      playerId: null,
      playerName: null,
    };
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
          // Check if host left
          const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, client.playerId) });
          if (player?.isHost) {
            // Transfer host to first other connected player
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
          if (state) {
            broadcast(client.roomCode, { type: "roomUpdate", payload: state });
          }
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

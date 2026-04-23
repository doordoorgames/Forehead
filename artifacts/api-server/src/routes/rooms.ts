import { Router } from "express";
import { db } from "@workspace/db";
import { roomsTable, playersTable, categoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateRoomBody,
  GetRoomParams,
  JoinRoomParams,
  JoinRoomBody,
} from "@workspace/api-zod";

const router = Router();

function generateRoomCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

async function getRoomWithPlayers(roomId: number) {
  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });
  if (!room) return null;
  const players = await db.select().from(playersTable).where(eq(playersTable.roomId, roomId));
  let categoryName: string | null = null;
  if (room.categoryId) {
    const cat = await db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, room.categoryId) });
    categoryName = cat?.name ?? null;
  }
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    mode: room.mode,
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
    createdAt: room.createdAt.toISOString(),
  };
}

// POST /api/rooms
router.post("/rooms", async (req, res) => {
  const body = CreateRoomBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  let code = generateRoomCode();
  // Ensure unique code
  let existing = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, code) });
  while (existing) {
    code = generateRoomCode();
    existing = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, code) });
  }

  const mode = (req.body.mode as string) === 'character' ? 'character' : 'forehead';
  const lang = (req.body.lang as string) === 'ar' ? 'ar' : 'en';
  const [room] = await db.insert(roomsTable).values({
    code,
    mode,
    lang,
    categoryId: body.data.categoryId ?? null,
    turnDuration: body.data.turnDuration ?? 60,
    roundCount: body.data.roundCount ?? 1,
  }).returning();

  const [player] = await db.insert(playersTable).values({
    roomId: room.id,
    name: body.data.hostName,
    isHost: true,
    score: 0,
    connected: true,
  }).returning();

  const result = await getRoomWithPlayers(room.id);
  res.status(201).json({ ...result, hostPlayerId: player.id });
});

// GET /api/rooms/:code
router.get("/rooms/:code", async (req, res) => {
  const params = GetRoomParams.safeParse({ code: req.params.code });
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, params.data.code) });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  const result = await getRoomWithPlayers(room.id);
  res.json(result);
});

// POST /api/rooms/:code/join
router.post("/rooms/:code/join", async (req, res) => {
  const params = JoinRoomParams.safeParse({ code: req.params.code });
  const body = JoinRoomBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.code, params.data.code) });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  if (room.status !== "waiting") {
    res.status(400).json({ error: "Game already in progress" });
    return;
  }

  // Check duplicate names
  const existing = await db.query.playersTable.findFirst({
    where: and(eq(playersTable.roomId, room.id), eq(playersTable.name, body.data.playerName)),
  });
  if (existing) {
    res.status(400).json({ error: "Name already taken in this room" });
    return;
  }

  const [player] = await db.insert(playersTable).values({
    roomId: room.id,
    name: body.data.playerName,
    isHost: false,
    score: 0,
    connected: true,
  }).returning();

  const result = await getRoomWithPlayers(room.id);
  res.json({
    room: result,
    playerId: player.id,
    playerName: player.name,
  });
});

export default router;

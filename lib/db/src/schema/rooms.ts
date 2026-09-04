import { serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { foreheadSchema } from "./namespace";

export const roomsTable = foreheadSchema.table("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("waiting"),
  mode: text("mode").notNull().default("forehead"), // "forehead" | "character"
  lang: text("lang").notNull().default("en"), // "en" | "ar"
  categoryId: integer("category_id").references(() => categoriesTable.id),
  turnDuration: integer("turn_duration").notNull().default(60),
  roundCount: integer("round_count").notNull().default(1),
  currentTurnPlayerId: integer("current_turn_player_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playersTable = foreheadSchema.table("players", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isHost: boolean("is_host").notNull().default(false),
  score: integer("score").notNull().default(0),
  connected: boolean("connected").notNull().default(true),
  sessionToken: text("session_token"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const turnsTable = foreheadSchema.table("turns", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  itemId: integer("item_id"),
  itemText: text("item_text"),
  imageUrl: text("image_url"),
  result: text("result"), // "correct" | "pass" | "timeout"
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  turnNumber: integer("turn_number").notNull().default(0),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, joinedAt: true });
export const insertTurnSchema = createInsertSchema(turnsTable).omit({ id: true, startedAt: true });

export type Room = typeof roomsTable.$inferSelect;
export type Player = typeof playersTable.$inferSelect;
export type Turn = typeof turnsTable.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertTurn = z.infer<typeof insertTurnSchema>;

import { db, charactersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

export interface CharacterEntry {
  id: number;
  answer: string;
  hints: string[];
  lang: string;
}

export async function getCharacterPool(lang: string): Promise<CharacterEntry[]> {
  const rows = await db.select().from(charactersTable).where(eq(charactersTable.lang, lang));
  return rows.map(r => ({ id: r.id, answer: r.answer, hints: r.hints as string[], lang: r.lang }));
}

export async function characterPoolSize(lang: string): Promise<number> {
  const result = await db.select({ value: count() }).from(charactersTable).where(eq(charactersTable.lang, lang));
  return Number(result[0]?.value ?? 0);
}

export async function insertCharacters(entries: { answer: string; hints: string[]; lang: string }[]): Promise<number> {
  if (entries.length === 0) return 0;
  await db.insert(charactersTable).values(entries.map(e => ({ answer: e.answer, hints: e.hints, lang: e.lang })));
  return entries.length;
}

export async function listAllCharacters(lang?: string): Promise<CharacterEntry[]> {
  const rows = lang
    ? await db.select().from(charactersTable).where(eq(charactersTable.lang, lang))
    : await db.select().from(charactersTable);
  return rows.map(r => ({ id: r.id, answer: r.answer, hints: r.hints as string[], lang: r.lang }));
}

export async function deleteCharacter(id: number): Promise<void> {
  await db.delete(charactersTable).where(eq(charactersTable.id, id));
}

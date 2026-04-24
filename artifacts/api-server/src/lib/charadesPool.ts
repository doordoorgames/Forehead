import { db } from "@workspace/db";
import { charadesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CharadeEntry {
  id: number;
  answer: string;
  lang: string;
}

export async function getCharadesPool(lang: string): Promise<CharadeEntry[]> {
  const rows = await db
    .select({ id: charadesTable.id, answer: charadesTable.answer, lang: charadesTable.lang })
    .from(charadesTable)
    .where(eq(charadesTable.lang, lang));
  return rows;
}

export async function insertCharades(
  entries: Array<{ answer: string; lang: string }>
): Promise<void> {
  for (const entry of entries) {
    await db.insert(charadesTable).values({ answer: entry.answer, lang: entry.lang });
  }
}

export async function listAllCharades(lang?: string): Promise<CharadeEntry[]> {
  if (lang) {
    return db
      .select({ id: charadesTable.id, answer: charadesTable.answer, lang: charadesTable.lang })
      .from(charadesTable)
      .where(eq(charadesTable.lang, lang));
  }
  return db
    .select({ id: charadesTable.id, answer: charadesTable.answer, lang: charadesTable.lang })
    .from(charadesTable);
}

export async function deleteCharade(id: number): Promise<void> {
  await db.delete(charadesTable).where(eq(charadesTable.id, id));
}

export async function deleteAllCharades(lang: string): Promise<void> {
  await db.delete(charadesTable).where(eq(charadesTable.lang, lang));
}

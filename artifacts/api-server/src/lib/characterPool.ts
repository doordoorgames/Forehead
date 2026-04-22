export interface CharacterEntry {
  answer: string;
  hints: string[];
}

let pool: CharacterEntry[] = [];

export function setCharacterPool(entries: CharacterEntry[]): void {
  pool = entries;
}

export function getCharacterPool(): CharacterEntry[] {
  return pool;
}

export function characterPoolSize(): number {
  return pool.length;
}

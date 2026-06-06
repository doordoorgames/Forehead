const SUPABASE_URL = 'https://qvzxjtyvbfexuhmmqbzl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enhqdHl2YmZleHVobW1xYnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg1MDAsImV4cCI6MjA5NDUyNDUwMH0.NLFRSK77OV83ZUJ4lK_q0kMXD0a5BGiXrEsrQgQJBmg';

export interface SupabaseCharacterEntry {
  id: number;
  answer: string;
  hints: string[];
  lang: string;
}

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
};

export async function fetchCharactersFromSupabase(
  lang: string,
): Promise<{ characters: SupabaseCharacterEntry[]; error: string | null }> {
  const selectedLanguage = lang === 'ar' ? 'arabic' : 'english';
  console.log('[CharacterGame] selectedLanguage:', selectedLanguage);

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/character_questions_test` +
      `?language=eq.${encodeURIComponent(selectedLanguage)}&category=eq.characters&select=*`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      const msg = `Supabase character fetch failed: HTTP ${res.status} — ${body}`;
      console.error(msg);
      return { characters: [], error: msg };
    }

    const rows = (await res.json()) as Array<{
      answer: string;
      hint_1?: string; hint_2?: string; hint_3?: string; hint_4?: string; hint_5?: string;
      hint_6?: string; hint_7?: string; hint_8?: string; hint_9?: string; hint_10?: string;
      language: string; category: string;
    }>;

    console.log(`[CharacterGame] Fetched ${rows.length} rows for language "${selectedLanguage}"`);
    if (rows.length > 0) console.log('[CharacterGame] First row:', JSON.stringify(rows[0]));

    if (rows.length === 0) {
      return { characters: [], error: 'No characters found for this language.' };
    }

    const characters: SupabaseCharacterEntry[] = rows.map((row, i) => ({
      id: i,
      answer: row.answer,
      hints: [
        row.hint_1, row.hint_2, row.hint_3, row.hint_4, row.hint_5,
        row.hint_6, row.hint_7, row.hint_8, row.hint_9, row.hint_10,
      ].filter((h): h is string => !!h),
      lang,
    }));

    return { characters, error: null };
  } catch (err) {
    const msg = `Supabase character fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { characters: [], error: msg };
  }
}

export async function fetchForeheadWordsByKKCategory(
  categoryId: number,
): Promise<{ words: string[]; error: string | null }> {
  console.log(`[Forehead] Fetching words for kk_entries category_id=${categoryId}`);
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/kk_entries` +
      `?category_id=eq.${categoryId}&active=eq.true&select=answer`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      const msg = `Supabase kk_entries fetch failed: HTTP ${res.status} — ${body}`;
      console.error(msg);
      return { words: [], error: msg };
    }
    const rows = (await res.json()) as { answer: string }[];
    console.log(`[Forehead] Loaded ${rows.length} entries for category_id=${categoryId}`);
    return { words: rows.map((r) => r.answer), error: null };
  } catch (err) {
    const msg = `Supabase kk_entries fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { words: [], error: msg };
  }
}

/** @deprecated Use fetchForeheadWordsByKKCategory instead */
export async function fetchForeheadWordsFromSupabase(
  table: string,
  category: string,
): Promise<{ words: string[]; error: string | null }> {
  console.log('Fetching Forehead entries from Supabase…');
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}` +
      `?active=eq.true&category=eq.${encodeURIComponent(category)}&select=word`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      const msg = `Supabase fetch failed: HTTP ${res.status} — ${body}`;
      console.error(msg);
      return { words: [], error: msg };
    }
    const rows = (await res.json()) as { word: string }[];
    console.log(`Loaded ${rows.length} entries successfully`);
    return { words: rows.map((r) => r.word), error: null };
  } catch (err) {
    const msg = `Supabase fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { words: [], error: msg };
  }
}

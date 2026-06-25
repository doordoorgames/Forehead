const SUPABASE_URL = 'https://qvzxjtyvbfexuhmmqbzl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enhqdHl2YmZleHVobW1xYnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg1MDAsImV4cCI6MjA5NDUyNDUwMH0.NLFRSK77OV83ZUJ4lK_q0kMXD0a5BGiXrEsrQgQJBmg';

export interface SupabaseCharacterEntry {
  id: number;
  answer: string;
  hints: string[];
}

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
};

const ARABIC_RE = /[\u0600-\u06FF]/;

export async function fetchCharactersFromSupabase(
  lang?: string,
): Promise<{ characters: SupabaseCharacterEntry[]; error: string | null }> {
  const wantArabic = lang === 'ar';
  console.log(`[CharacterGame] Fetching from guess_the_character (lang=${lang ?? 'en'})`);

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/guess_the_character` +
      `?select=id,answer,hint1,hint2,hint3,hint4,hint5,hint6,hint7,hint8,hint9,hint10`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      const msg = `Supabase character fetch failed: HTTP ${res.status} — ${body}`;
      console.error(msg);
      return { characters: [], error: msg };
    }

    const rows = (await res.json()) as Array<{
      id: number;
      answer: string;
      hint1?: string; hint2?: string; hint3?: string; hint4?: string; hint5?: string;
      hint6?: string; hint7?: string; hint8?: string; hint9?: string; hint10?: string;
    }>;

    console.log(`[CharacterGame] Fetched ${rows.length} total rows from guess_the_character`);

    // Filter to the correct language by detecting Arabic characters in the answer.
    // English rows have Latin answers; Arabic rows have Arabic-script answers.
    const filtered = rows.filter((r) => ARABIC_RE.test(r.answer) === wantArabic);

    console.log(`[CharacterGame] ${filtered.length} rows match lang="${lang ?? 'en'}"`);

    if (filtered.length === 0) {
      return { characters: [], error: 'No characters found in Supabase.' };
    }

    const characters: SupabaseCharacterEntry[] = filtered.map((row) => ({
      id: row.id,
      answer: row.answer,
      hints: [
        row.hint1, row.hint2, row.hint3, row.hint4, row.hint5,
        row.hint6, row.hint7, row.hint8, row.hint9, row.hint10,
      ].filter((h): h is string => !!h),
    }));

    return { characters, error: null };
  } catch (err) {
    const msg = `Supabase character fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { characters: [], error: msg };
  }
}

/**
 * Fetch all active charades phrases from the Supabase `charades` table.
 * lang='en' → language='English', lang='ar' → language='Arabic'.
 * Returns shuffled results so each game session has a different order.
 */
export async function fetchCharadesFromSupabase(
  lang: string,
): Promise<{ words: Array<{ id: number; answer: string }>; error: string | null }> {
  const language = lang === 'ar' ? 'Arabic' : 'English';
  console.log(`[Charades] Fetching from Supabase (language="${language}")`);

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/charades` +
      `?active=eq.true&language=eq.${encodeURIComponent(language)}&select=id,phrase`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      const msg = `Supabase charades fetch failed: HTTP ${res.status} — ${body}`;
      console.error(msg);
      return { words: [], error: msg };
    }

    const rows = (await res.json()) as Array<{ id: number; phrase: string }>;
    console.log(`[Charades] Fetched ${rows.length} rows for language="${language}"`);

    if (rows.length === 0) {
      return { words: [], error: 'No charades entries found for this language.' };
    }

    // Shuffle so each game session gets a different order
    const shuffled = rows
      .map((r) => ({ id: r.id, answer: r.phrase }))
      .sort(() => Math.random() - 0.5);

    return { words: shuffled, error: null };
  } catch (err) {
    const msg = `Supabase charades fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { words: [], error: msg };
  }
}

/**
 * Fetch all active words for a category from the flat forehead tables.
 * Uses forehead_english for lang='en', forehead_arabic for lang='ar'.
 * The categoryName must match the `category` column exactly as stored in Supabase.
 */
export async function fetchForeheadWordsByFlatCategory(
  categoryName: string,
  lang?: string,
): Promise<{ words: string[]; error: string | null }> {
  const errMsg = lang === 'ar' ? 'تعذر تحميل الكلمات' : 'Could not load words for this category.';
  const table = lang === 'ar' ? 'forehead_arabic' : 'forehead_english';

  console.log(`[Forehead] Fetching words from ${table} WHERE category="${categoryName}"`);

  try {
    // Supabase REST API hard-caps at 1000 rows per response regardless of the
    // limit param. Paginate with offset until we get a partial page.
    const PAGE = 1000;
    const allRows: { word: string }[] = [];
    let offset = 0;
    while (true) {
      const url =
        `${SUPABASE_URL}/rest/v1/${table}` +
        `?category=eq.${encodeURIComponent(categoryName)}&active=eq.true&select=word&limit=${PAGE}&offset=${offset}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[Forehead] ${table} fetch failed: HTTP ${res.status} — ${body}`);
        return { words: [], error: errMsg };
      }
      const page = (await res.json()) as { word: string }[];
      allRows.push(...page);
      if (page.length < PAGE) break;
      offset += PAGE;
    }
    console.log(`[Forehead] Loaded ${allRows.length} words for category "${categoryName}" from ${table}`);
    return { words: allRows.map((r) => r.word), error: null };
  } catch (err) {
    console.error('[Forehead] fetchForeheadWordsByFlatCategory error:', err);
    return { words: [], error: errMsg };
  }
}

/** @deprecated Use fetchForeheadWordsByFlatCategory instead */
export async function fetchForeheadWordsByKKCategory(
  categoryId: number,
  lang?: string,
): Promise<{ words: string[]; error: string | null }> {
  const errMsg = lang === 'ar' ? 'تعذر تحميل الكلمات' : 'Could not load words for this category.';
  console.log(`[Forehead] fetchForeheadWordsByKKCategory called (deprecated) category_id=${categoryId}`);
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/kk_entries` +
      `?category_id=eq.${categoryId}&active=eq.true&select=answer`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      console.error(`kk_entries fetch failed: HTTP ${res.status} — ${body}`);
      return { words: [], error: errMsg };
    }
    const rows = (await res.json()) as { answer: string }[];
    console.log(`[Forehead] Loaded ${rows.length} entries for category_id=${categoryId}`);
    return { words: rows.map((r) => r.answer), error: null };
  } catch (err) {
    console.error('fetchForeheadWordsByKKCategory error:', err);
    return { words: [], error: errMsg };
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

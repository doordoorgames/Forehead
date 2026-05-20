const SUPABASE_URL = 'https://qvzxjtyvbfexuhmmqbzl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enhqdHl2YmZleHVobW1xYnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg1MDAsImV4cCI6MjA5NDUyNDUwMH0.NLFRSK77OV83ZUJ4lK_q0kMXD0a5BGiXrEsrQgQJBmg';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
};

export interface ForeheadCategory {
  name: string;
  table: string;
  wordCount: number;
}

export async function fetchForeheadCategories(
  lang: 'en' | 'ar',
): Promise<{ categories: ForeheadCategory[]; error: string | null }> {
  const table = lang === 'ar' ? 'forehead_arabic' : 'forehead_english';
  console.log('Fetching Forehead entries from Supabase…');
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?active=eq.true&select=category,word`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      const msg = `Supabase fetch failed: HTTP ${res.status} — ${body}`;
      console.error(msg);
      return { categories: [], error: msg };
    }
    const rows: { category: string; word: string }[] = await res.json();
    console.log(`Loaded ${rows.length} entries successfully`);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
    const categories: ForeheadCategory[] = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, wordCount]) => ({ name, table, wordCount }));

    return { categories, error: null };
  } catch (err) {
    const msg = `Supabase fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { categories: [], error: msg };
  }
}

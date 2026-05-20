const SUPABASE_URL = 'https://qvzxjtyvbfexuhmmqbzl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enhqdHl2YmZleHVobW1xYnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg1MDAsImV4cCI6MjA5NDUyNDUwMH0.NLFRSK77OV83ZUJ4lK_q0kMXD0a5BGiXrEsrQgQJBmg';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
};

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

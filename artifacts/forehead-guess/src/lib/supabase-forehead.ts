const SUPABASE_URL = 'https://qvzxjtyvbfexuhmmqbzl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enhqdHl2YmZleHVobW1xYnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg1MDAsImV4cCI6MjA5NDUyNDUwMH0.NLFRSK77OV83ZUJ4lK_q0kMXD0a5BGiXrEsrQgQJBmg';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
};

export interface ForeheadCategory {
  id: number;
  name: string;
  wordCount: number;
}

export async function fetchForeheadCategories(
  lang: 'en' | 'ar',
): Promise<{ categories: ForeheadCategory[]; error: string | null }> {
  try {
    const catUrl =
      `${SUPABASE_URL}/rest/v1/kk_categories` +
      `?language=eq.${encodeURIComponent(lang)}&active=eq.true&select=id,category_name&order=category_name.asc`;

    const catRes = await fetch(catUrl, { headers: HEADERS });
    if (!catRes.ok) {
      const body = await catRes.text();
      console.error(`kk_categories fetch failed: HTTP ${catRes.status} — ${body}`);
      return { categories: [], error: 'Could not load categories. Please try again.' };
    }

    const catRows: { id: number; category_name: string }[] = await catRes.json();
    if (catRows.length === 0) {
      return { categories: [], error: null };
    }

    const entryUrl =
      `${SUPABASE_URL}/rest/v1/kk_entries?active=eq.true&select=category_id`;
    const entryRes = await fetch(entryUrl, { headers: HEADERS });
    const countMap: Record<number, number> = {};
    if (entryRes.ok) {
      const entryRows: { category_id: number }[] = await entryRes.json();
      for (const row of entryRows) {
        countMap[row.category_id] = (countMap[row.category_id] ?? 0) + 1;
      }
    }

    const categories: ForeheadCategory[] = catRows.map((row) => ({
      id: row.id,
      name: row.category_name,
      wordCount: countMap[row.id] ?? 0,
    }));

    return { categories, error: null };
  } catch (err) {
    const msg = `Could not load categories. Please try again.`;
    console.error('fetchForeheadCategories error:', err);
    return { categories: [], error: msg };
  }
}

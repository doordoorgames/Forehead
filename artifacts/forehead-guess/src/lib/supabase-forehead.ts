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

export interface ForeheadCategoriesResult {
  categories: ForeheadCategory[];
  error: string | null;
  debugTotalRows: number;
  debugTotalCategories: number;
}

export async function fetchForeheadCategories(
  lang: 'en' | 'ar',
): Promise<ForeheadCategoriesResult> {
  const errorMsg = lang === 'ar'
    ? 'تعذر تحميل التصنيفات'
    : 'Could not load categories. Please try again.';

  const empty: ForeheadCategoriesResult = {
    categories: [],
    error: null,
    debugTotalRows: 0,
    debugTotalCategories: 0,
  };

  try {
    // Step 1: fetch all active categories for this language
    const catUrl =
      `${SUPABASE_URL}/rest/v1/kk_categories` +
      `?language=eq.${encodeURIComponent(lang)}&active=eq.true` +
      `&select=id,category_name&order=category_name.asc`;

    const catRes = await fetch(catUrl, { headers: HEADERS });
    if (!catRes.ok) {
      const body = await catRes.text();
      console.error(`[Forehead] kk_categories fetch failed: HTTP ${catRes.status} — ${body}`);
      return { ...empty, error: errorMsg };
    }

    const catRows: { id: number; category_name: string }[] = await catRes.json();
    if (catRows.length === 0) {
      console.log('[Forehead] No categories found for lang:', lang);
      return empty;
    }

    // Step 2: fetch entry counts scoped to ONLY this language's category IDs.
    // Using category_id=in.(id1,id2,...) avoids the global 1000-row page limit
    // that would otherwise silently truncate results.
    const idList = catRows.map((r) => r.id).join(',');
    const entryUrl =
      `${SUPABASE_URL}/rest/v1/kk_entries` +
      `?category_id=in.(${idList})&active=eq.true&select=category_id&limit=50000`;

    const entryRes = await fetch(entryUrl, { headers: HEADERS });
    const countMap: Record<number, number> = {};
    let totalRows = 0;

    if (entryRes.ok) {
      const entryRows: { category_id: number }[] = await entryRes.json();
      totalRows = entryRows.length;
      for (const row of entryRows) {
        countMap[row.category_id] = (countMap[row.category_id] ?? 0) + 1;
      }
    }

    // Step 3: build category list, filtering out any with zero entries
    const categories: ForeheadCategory[] = catRows
      .map((row) => ({
        id: row.id,
        name: row.category_name,
        wordCount: countMap[row.id] ?? 0,
      }))
      .filter((cat) => cat.wordCount > 0);

    console.log(`[Forehead] Arabic categories loaded:`, categories);
    console.log(
      `[Forehead] Total rows: ${totalRows}, categories with words: ${categories.length}`,
    );

    return {
      categories,
      error: null,
      debugTotalRows: totalRows,
      debugTotalCategories: categories.length,
    };
  } catch (err) {
    console.error('[Forehead] fetchForeheadCategories error:', err);
    return { ...empty, error: errorMsg };
  }
}

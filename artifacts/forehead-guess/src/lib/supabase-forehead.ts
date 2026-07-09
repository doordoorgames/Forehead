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

/**
 * Fetch all active categories for the given language from the flat tables
 * (forehead_english / forehead_arabic). Categories are derived dynamically
 * from the `category` column — no hardcoded list is used.
 */
export async function fetchForeheadCategories(
  lang: 'en' | 'ar',
): Promise<ForeheadCategoriesResult> {
  const table = lang === 'ar' ? 'forehead_arabic_1' : 'forehead_english';
  const errorMsg =
    lang === 'ar'
      ? 'تعذر تحميل التصنيفات'
      : 'Could not load categories. Please try again.';

  const empty: ForeheadCategoriesResult = {
    categories: [],
    error: null,
    debugTotalRows: 0,
    debugTotalCategories: 0,
  };

  try {
    // Supabase REST API hard-caps at 1000 rows per response regardless of the
    // limit param. Paginate with offset until we get a partial page.
    const PAGE = 1000;
    const rows: { category: string }[] = [];
    let offset = 0;
    while (true) {
      const url =
        `${SUPABASE_URL}/rest/v1/${table}` +
        `?active=eq.true&select=category&limit=${PAGE}&offset=${offset}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[Forehead] ${table} fetch failed: HTTP ${res.status} — ${body}`);
        return { ...empty, error: errorMsg };
      }
      const page: { category: string }[] = await res.json();
      rows.push(...page);
      if (page.length < PAGE) break;
      offset += PAGE;
    }
    const totalRows = rows.length;

    // Group by category text exactly as stored in Supabase
    const countMap: Record<string, number> = {};
    for (const row of rows) {
      if (row.category) {
        countMap[row.category] = (countMap[row.category] ?? 0) + 1;
      }
    }

    // Build and sort alphabetically; filter out any accidental 0-count entries
    const categories: ForeheadCategory[] = Object.entries(countMap)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, wordCount], i) => ({ id: i + 1, name, wordCount }));

    const totalCategories = categories.length;

    console.log(`[Forehead] ${lang.toUpperCase()} categories loaded (${totalCategories}):`, categories.map((c) => `${c.name} (${c.wordCount})`));
    console.log(`[Forehead] Total ${lang.toUpperCase()} rows: ${totalRows}`);

    return { categories, error: null, debugTotalRows: totalRows, debugTotalCategories: totalCategories };
  } catch (err) {
    console.error('[Forehead] fetchForeheadCategories error:', err);
    return { ...empty, error: errorMsg };
  }
}

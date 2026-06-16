import type { DykmQuestion } from '@/hooks/useGameSocket';

const SUPABASE_URL = 'https://qvzxjtyvbfexuhmmqbzl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enhqdHl2YmZleHVobW1xYnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg1MDAsImV4cCI6MjA5NDUyNDUwMH0.NLFRSK77OV83ZUJ4lK_q0kMXD0a5BGiXrEsrQgQJBmg';

const EN_TABLE = 'do_you_know_me_questions';
const AR_TABLE = 'do_you_know_me_questions_ar';

interface SupabaseRow {
  id: number;
  category: string;
  question: string;
  intensity: string | null;
  active: boolean | null;
  created_at: string;
}

export interface DykmFetchResult {
  questions: DykmQuestion[];
  error: string | null;
}

async function fetchFromTable(table: string): Promise<DykmFetchResult> {
  const baseUrl = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json',
  };

  try {
    // Try with active filter first
    const urlWithActive = `${baseUrl}?active=eq.true&select=id,category,question,intensity,active,created_at`;
    const res = await fetch(urlWithActive, { headers });

    let rows: SupabaseRow[];

    if (res.ok) {
      rows = await res.json();
    } else {
      // Fallback: fetch without active filter (table may not have that column)
      const urlAll = `${baseUrl}?select=id,category,question`;
      const res2 = await fetch(urlAll, { headers });
      if (!res2.ok) {
        const body = await res2.text();
        return { questions: [], error: `Supabase error: HTTP ${res2.status} — ${body}` };
      }
      rows = await res2.json();
    }

    const questions: DykmQuestion[] = rows.map(row => ({
      id: row.id,
      question: row.question,
      categoryId: 0,
      categoryName: row.category ?? 'General',
    }));

    return { questions, error: null };
  } catch (err) {
    const msg = `Supabase error: ${err instanceof Error ? err.message : String(err)}`;
    return { questions: [], error: msg };
  }
}

export async function fetchDykmQuestionsFromSupabase(lang: 'en' | 'ar' = 'en'): Promise<DykmFetchResult> {
  const table = lang === 'ar' ? AR_TABLE : EN_TABLE;
  return fetchFromTable(table);
}

export function getDykmCategories(questions: DykmQuestion[]): string[] {
  const seen = new Set<string>();
  const cats: string[] = [];
  for (const q of questions) {
    if (!seen.has(q.categoryName)) {
      seen.add(q.categoryName);
      cats.push(q.categoryName);
    }
  }
  return cats.sort((a, b) => a.localeCompare(b));
}

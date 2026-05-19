import type { DykmQuestion } from '@/hooks/useGameSocket';

const SUPABASE_URL = 'https://qvzxjtyvbfexuhmmqbzl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enhqdHl2YmZleHVobW1xYnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg1MDAsImV4cCI6MjA5NDUyNDUwMH0.NLFRSK77OV83ZUJ4lK_q0kMXD0a5BGiXrEsrQgQJBmg';

const REST_URL = `${SUPABASE_URL}/rest/v1/do_you_know_me_questions`;

interface SupabaseRow {
  id: number;
  category: string;
  question: string;
  intensity: string | null;
  active: boolean;
  created_at: string;
}

export interface DykmFetchResult {
  questions: DykmQuestion[];
  error: string | null;
}

export async function fetchDykmQuestionsFromSupabase(): Promise<DykmFetchResult> {
  console.log('Fetching Do You Know Me questions from Supabase…');

  try {
    const url = `${REST_URL}?active=eq.true&select=id,category,question,intensity,active,created_at`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      const msg = `Supabase error: HTTP ${res.status} — ${body}`;
      console.error(msg);
      return { questions: [], error: msg };
    }

    const rows: SupabaseRow[] = await res.json();
    console.log(`Loaded ${rows.length} Do You Know Me questions`);

    const questions: DykmQuestion[] = rows.map(row => ({
      id: row.id,
      question: row.question,
      categoryId: 0,
      categoryName: row.category ?? 'General',
    }));

    return { questions, error: null };
  } catch (err) {
    const msg = `Supabase error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { questions: [], error: msg };
  }
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

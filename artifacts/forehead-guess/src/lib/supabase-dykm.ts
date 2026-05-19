import { createClient } from '@supabase/supabase-js';
import type { DykmQuestion } from '@/hooks/useGameSocket';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_DYKM_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_DYKM_ANON_KEY as string;

export const supabaseDykm = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface SupabaseRow {
  id: number;
  category: string;
  question: string;
  intensity: string | null;
  active: boolean;
  created_at: string;
}

export async function fetchDykmQuestionsFromSupabase(): Promise<DykmQuestion[]> {
  const { data, error } = await supabaseDykm
    .from('do_you_know_me_questions')
    .select('id, category, question, intensity, active, created_at')
    .eq('active', true);

  if (error) {
    console.error('[DYKM] Supabase fetch error:', error.message);
    return [];
  }

  return (data as SupabaseRow[]).map(row => ({
    id: row.id,
    question: row.question,
    categoryId: 0,
    categoryName: row.category,
  }));
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

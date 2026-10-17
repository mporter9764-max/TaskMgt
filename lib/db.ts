import { supabase } from "./supabase";

/** Select every row of a table, paging past Supabase's 1,000-row response cap. */
export async function fetchAll<T>(table: string, order: string, ascending = true): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending })
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

/** Persist a new display order: sort_order = position in the list. */
export async function saveOrder(table: string, ids: string[]): Promise<string | null> {
  const results = await Promise.all(
    ids.map((id, i) => supabase.from(table).update({ sort_order: i }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  return failed?.error?.message ?? null;
}

export function moveItem<T>(list: T[], index: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

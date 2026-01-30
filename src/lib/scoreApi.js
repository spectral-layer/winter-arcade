import { supabase } from "./supabaseClient";

export async function submitScore({ wallet, game, score }) {
  const { data, error } = await supabase.functions.invoke("submit-score", {
    body: { wallet, game, score },
  });

  if (error) throw error;
  return data;
}
export async function getLeaderboard({ limit = 20, offset = 0 } = {}) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const url = `${baseUrl}/functions/v1/get-leaderboard?limit=${encodeURIComponent(
    limit
  )}&offset=${encodeURIComponent(offset)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Supabase Functions spesso richiedono questi header anche per GET
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `get-leaderboard failed (${res.status})`);
  }

  return data;
}

import { supabase } from "./supabaseClient";

export async function fetchTopScores(game, limit = 10) {
  const { data, error } = await supabase
    .from("leaderboard_best")
    .select("wallet, game, score")
    .eq("game", game)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

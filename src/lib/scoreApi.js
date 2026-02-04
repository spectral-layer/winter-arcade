// src/lib/scoreApi.js
import { supabase } from "./supabaseClient";

// -------------------------
// SUBMIT SCORE (POST)
// -------------------------
export async function submitScore({ wallet, game, score }) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }

  const url = `${baseUrl}/functions/v1/submit-score`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-supabase-client-platform": "web",
    },
    body: JSON.stringify({ wallet, game, score }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `submit-score failed (${res.status})`);
  }

  return data;
}

// -------------------------
// LEADERBOARD (GET)
// -------------------------
export async function getLeaderboard({ limit = 20, offset = 0 } = {}) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }

  const url = `${baseUrl}/functions/v1/get-leaderboard?limit=${encodeURIComponent(
    limit
  )}&offset=${encodeURIComponent(offset)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-supabase-client-platform": "web",
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `get-leaderboard failed (${res.status})`);
  }

  return data;
}

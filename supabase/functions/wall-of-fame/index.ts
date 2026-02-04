// supabase/functions/wall-of-fame/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    ...corsHeaders(origin),
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers }
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // freeze flag (se lo usi già nel progetto)
    const frozen = (Deno.env.get("LEADERBOARD_FROZEN") || "false").toLowerCase() === "true";

    // ✅ SOLO snowball
    // Se frozen=true usa la view/table wall_of_fame (se esiste e ha best_snowball/total)
    // Altrimenti usa leaderboard_best.
    let rows: any[] = [];

    if (frozen) {
      const { data, error } = await supabase
        .from("wall_of_fame")
        .select("wallet,total,best_snowball")
        .order("total", { ascending: false })
        .limit(20);

      if (error) throw error;
      rows = data ?? [];
    } else {
      // live: prendi i best per wallet del solo gioco snowball
      const { data, error } = await supabase
        .from("leaderboard_best")
        .select("wallet,score,game")
        .eq("game", "snowball")
        .order("score", { ascending: false })
        .limit(20);

      if (error) throw error;

      rows = (data ?? []).map((r: any) => ({
        wallet: r.wallet,
        best_snowball: r.score,
        total: r.score, // con un solo gioco, total = best_snowball
      }));
    }

    const winner = rows.length
      ? {
          wallet: rows[0].wallet,
          total: rows[0].total ?? rows[0].best_snowball ?? 0,
          best_snowball: rows[0].best_snowball ?? 0,
        }
      : null;

    const top20 = rows.map((r) => ({
      wallet: r.wallet,
      total: r.total ?? r.best_snowball ?? 0,
      best_snowball: r.best_snowball ?? 0,
    }));

    return new Response(JSON.stringify({ frozen, winner, top20 }), {
      status: 200,
      headers,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers }
    );
  }
});

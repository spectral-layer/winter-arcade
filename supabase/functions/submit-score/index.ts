/* eslint-disable */
// supabase/functions/submit-score/index.ts
/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function nowMs() {
  return Date.now();
}

// Consiglio: mantieni un'allowlist minimale per dev + prod
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://spectral-layer.github.io",
]);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://spectral-layer.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // ✅ qui sta il fix: includiamo x-supabase-client-platform
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    // non indispensabile, ma utile per caching corretto
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  const cors = getCorsHeaders(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "Method not allowed" }, 405);
  }

  // Freeze switch: se true, blocca qualsiasi submit
  const frozen =
    (Deno.env.get("LEADERBOARD_FROZEN") || "false").toLowerCase() === "true";
  if (frozen) {
    return jsonResponse(req, { ok: true, accepted: false, reason: "frozen" }, 200);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing env vars", {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return jsonResponse(
        req,
        { ok: false, error: "Server misconfigured (missing env vars)" },
        500
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = await req.json().catch(() => null);
    if (!payload) {
      return jsonResponse(req, { ok: false, error: "Invalid JSON body" }, 400);
    }

    const wallet = String(payload.wallet ?? "").trim();
    const game_in = String(payload.game ?? "").trim();

    // Mapping canonical -> valori consentiti dal DB (per il CHECK scores_game_check)
    let game = game_in;

    // UI/Canonical IDs
    if (game_in === "ice_slalom") game = "slalom";
    if (game_in === "snowball_frenzy") game = "snowball";

    // (opzionale) se mai arrivassero label umani
    if (game_in.toLowerCase() === "ice slalom") game = "slalom";
    if (game_in.toLowerCase() === "snowball frenzy") game = "snowball";

    const score = Number(payload.score);

    if (!wallet || wallet.length < 5) {
      return jsonResponse(req, { ok: false, error: "Invalid wallet" }, 400);
    }
    if (!game) {
      return jsonResponse(req, { ok: false, error: "Invalid game" }, 400);
    }
    if (!Number.isFinite(score) || score < 0) {
      return jsonResponse(req, { ok: false, error: "Invalid score" }, 400);
    }

    // ------------------------------------------------------------
    // Anti-spam: 1 submit per wallet ogni N secondi (server-side)
    // ------------------------------------------------------------
    const COOLDOWN_MS = 8000; // 8s (puoi alzare/abbassare)
    const { data: lastRow, error: lastErr } = await supabase
      .from("scores")
      .select("created_at")
      .eq("wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error("Cooldown check error:", lastErr);
      return jsonResponse(req, { ok: false, error: "Cooldown check failed" }, 500);
    }

    if (lastRow?.created_at) {
      const lastMs = Date.parse(String(lastRow.created_at));
      if (Number.isFinite(lastMs)) {
        const delta = nowMs() - lastMs;
        if (delta < COOLDOWN_MS) {
          return jsonResponse(
            req,
            {
              ok: true,
              accepted: false,
              reason: "cooldown",
              retry_in_ms: COOLDOWN_MS - delta,
            },
            200
          );
        }
      }
    }

    // ------------------------------------------------------------
    // Anti-cheat logico: accetta SOLO se è un miglioramento
    // per quel wallet + game (best score only)
    // ------------------------------------------------------------
    const { data: bestRow, error: bestErr } = await supabase
      .from("scores")
      .select("score")
      .eq("wallet", wallet)
      .eq("game", game)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bestErr) {
      console.error("Best score check error:", bestErr);
      return jsonResponse(req, { ok: false, error: "Best score check failed" }, 500);
    }

    const currentBest = bestRow?.score ?? null;

    // Se non migliora, non inseriamo nulla (evita spazzatura)
    if (currentBest !== null && Number(score) <= Number(currentBest)) {
      return jsonResponse(
        req,
        {
          ok: true,
          accepted: false,
          reason: "not_improved",
          current_best: currentBest,
          submitted: score,
        },
        200
      );
    }

    // ✅ run_id obbligatorio
    const run_id = crypto.randomUUID();

    const { data: inserted, error: insErr } = await supabase
      .from("scores")
      .insert([{ run_id, wallet, game, score }])
      .select()
      .single();

    if (insErr) {
      console.error("Insert error:", insErr);
      return jsonResponse(req, { ok: false, error: insErr.message }, 500);
    }

    return jsonResponse(
      req,
      {
        ok: true,
        accepted: true,
        previous_best: currentBest,
        data: inserted,
      },
      200
    );
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonResponse(req, { ok: false, error: "Unhandled server error" }, 500);
  }
});

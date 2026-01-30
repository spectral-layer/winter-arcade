// supabase/functions/submit-score/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function nowMs() {
  return Date.now();
}

// Allowlist dev+prod
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
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const frozen =
    (Deno.env.get("LEADERBOARD_FROZEN") || "false").toLowerCase() === "true";
  if (frozen) {
    return jsonResponse(req, {
      ok: true,
      accepted: false,
      reason: "frozen",
      current_best: null,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

    // Canonical mapping
    let game = game_in;
    if (game_in === "ice_slalom") game = "slalom";
    if (game_in === "snowball_frenzy") game = "snowball";
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

    // Best score (serve anche per rispondere sempre con current_best)
    const { data: bestRow, error: bestErr } = await supabase
      .from("scores")
      .select("score")
      .eq("wallet", wallet)
      .eq("game", game)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bestErr) {
      return jsonResponse(req, { ok: false, error: "Best score check failed" }, 500);
    }

    const currentBest = bestRow?.score ?? null;

    // Cooldown (wallet-wide)
    const COOLDOWN_MS = 8000;
    const { data: lastRow, error: lastErr } = await supabase
      .from("scores")
      .select("created_at")
      .eq("wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      return jsonResponse(req, { ok: false, error: "Cooldown check failed" }, 500);
    }

    if (lastRow?.created_at) {
      const lastMs = Date.parse(String(lastRow.created_at));
      if (Number.isFinite(lastMs)) {
        const delta = nowMs() - lastMs;
        if (delta < COOLDOWN_MS) {
          return jsonResponse(req, {
            ok: true,
            accepted: false,
            reason: "cooldown",
            retry_in_ms: COOLDOWN_MS - delta,
            current_best: currentBest,
            submitted: score,
          });
        }
      }
    }

    // Not improved
    if (currentBest !== null && Number(score) <= Number(currentBest)) {
      return jsonResponse(req, {
        ok: true,
        accepted: false,
        reason: "not_improved",
        current_best: currentBest,
        submitted: score,
      });
    }

    // Insert new best
    const run_id = crypto.randomUUID();
    const { data: inserted, error: insErr } = await supabase
      .from("scores")
      .insert([{ run_id, wallet, game, score }])
      .select()
      .single();

    if (insErr) {
      return jsonResponse(req, { ok: false, error: insErr.message }, 500);
    }

    return jsonResponse(req, {
      ok: true,
      accepted: true,
      reason: "improved",
      previous_best: currentBest,
      current_best: score,
      submitted: score,
      data: inserted,
    });
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonResponse(req, { ok: false, error: "Unhandled server error" }, 500);
  }
});

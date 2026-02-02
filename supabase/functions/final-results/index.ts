// supabase/functions/final-results/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://spectral-layer.github.io",
]);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://spectral-layer.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== "GET") {
    return jsonResponse(req, { ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const frozen =
      (Deno.env.get("LEADERBOARD_FROZEN") || "false").toLowerCase() === "true";

    if (!frozen) {
      return jsonResponse(
        req,
        { ok: false, finalized: false, error: "Not finalized yet. Leaderboard is not frozen." },
        409
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(req, { ok: false, error: "Missing env vars" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("leaderboard")
      .select("wallet,best_slalom,best_snowball,total")
      .order("total", { ascending: false })
      .order("wallet", { ascending: true })
      .limit(20);

    if (error) {
      console.error("Final results query error:", error);
      return jsonResponse(req, { ok: false, error: error.message }, 500);
    }

    const winner = data && data.length > 0 ? data[0] : null;

    return jsonResponse(req, {
      ok: true,
      finalized: true,
      frozen: true,
      generated_at: new Date().toISOString(),
      winner,
      top20: data ?? [],
    });
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonResponse(req, { ok: false, error: "Unhandled server error" }, 500);
  }
});

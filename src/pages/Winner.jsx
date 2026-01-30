import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "../components/BackButton.jsx";

export default function Winner() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [frozen, setFrozen] = useState(false);
  const [winner, setWinner] = useState(null);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;

  const liveUrl = useMemo(() => `${baseUrl}/functions/v1/wall-of-fame`, [baseUrl]);

  const finalUrl = useMemo(
    () => `${baseUrl}/functions/v1/final-results`,
    [baseUrl]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        // Always use wall-of-fame for Winner page
        const res = await fetch(liveUrl, { method: "GET" });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || `Winner fetch failed (${res.status})`);
        }

        if (!mounted) return;

        // Real data (production clean)
setFrozen(!!data?.frozen);
setWinner(data?.winner ?? null);

      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Winner loading error");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [liveUrl]);

  return (
    <div className="card">
      <BackButton to="/arcade" label="← Back to Arcade" />

      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h2 className="h2" style={{ margin: 0 }}>
          🏅 Winner
        </h2>

        {frozen ? (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.20)",
              background: "rgba(0,0,0,0.25)",
              fontSize: 12,
            }}
          >
            🧊 Official (Frozen)
          </span>
        ) : (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
              fontSize: 12,
              opacity: 0.9,
            }}
          >
            ⏳ Live Leader
          </span>
        )}
      </div>

      {loading && <p className="p">Loading…</p>}
      {err && (
        <p className="p" style={{ color: "tomato" }}>
          {err}
        </p>
      )}

      {!loading && !err && (
        <div
          style={{
            marginTop: 16,
            padding: 20,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.18)",
          }}
        >
          {winner ? (
            <>
              {/* CELEBRATION HERO */}
              {frozen ? (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.20)",
                    background:
                      "radial-gradient(1200px 400px at 20% 0%, rgba(255,215,0,0.20), transparent 60%)," +
                      "radial-gradient(900px 380px at 80% 10%, rgba(0,255,255,0.14), transparent 55%)," +
                      "rgba(0,0,0,0.18)",
                    marginBottom: 14,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* sparkle dots */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0.25,
                      backgroundImage:
                        "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 0 1px, transparent 2px)," +
                        "radial-gradient(circle at 80% 40%, rgba(255,255,255,0.9) 0 1px, transparent 2px)," +
                        "radial-gradient(circle at 60% 80%, rgba(255,255,255,0.7) 0 1px, transparent 2px)",
                      pointerEvents: "none",
                    }}
                  />

                  <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.9 }}>
                    🧊 OFFICIAL WINNER
                  </div>

                  <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
                    🏆 CHAMPION
                  </div>

                  {/* Official copy under title */}
                  <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
                    Contest concluded.
                    <br />
                    This is the official winner of the Winter Arcade.
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 20,
                      fontWeight: 800,
                      wordBreak: "break-all",
                    }}
                  >
                    {winner.wallet}
                  </div>

                  {/* Final note under wallet */}
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    Final results — leaderboard frozen
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>🏆 CURRENT LEADER</div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      marginTop: 8,
                      wordBreak: "break-all",
                      letterSpacing: 0.2,
                    }}
                  >
                    {winner.wallet}
                  </div>
                </>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 18,
                  flexWrap: "wrap",
                  marginTop: 16,
                }}
              >
                <Stat label="TOTAL" value={winner.total} big />
                <Stat label="ICE SLALOM" value={winner.best_slalom} />
                <Stat label="SNOWBALL FRENZY" value={winner.best_snowball} />
              </div>

              {/* CTA */}
              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Link className="btn" to="/wall-of-fame">
                  🏆 Wall of Fame
                </Link>

                {frozen ? (
                  <a className="btn" href={finalUrl} target="_blank" rel="noreferrer">
                    🔒 Final JSON (Official)
                  </a>
                ) : (
                  <a className="btn" href={liveUrl} target="_blank" rel="noreferrer">
                    📄 Live JSON
                  </a>
                )}
              </div>

              {/* NOTE */}
              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
                {frozen
                  ? "Leaderboard frozen: this result is final."
                  : "Live leaderboard: the leader can change until it is frozen."}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700 }}>No winner yet</div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>
                No scores have been submitted so far.
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Link className="btn" to="/arcade">
                  🎮 Back to Arcade
                </Link>
                <Link className="btn" to="/wall-of-fame">
                  🏆 Wall of Fame
                </Link>
                <a className="btn" href={liveUrl} target="_blank" rel="noreferrer">
                  📄 Live JSON
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, big = false }) {
  return (
    <div
      style={{
        minWidth: 140,
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.78 }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: big ? 22 : 18,
          fontWeight: big ? 800 : 650,
        }}
      >
        {value ?? 0}
      </div>
    </div>
  );
}

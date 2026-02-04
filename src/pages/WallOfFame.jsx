// src/pages/WallOfFame.jsx
import { useEffect, useState } from "react";
import BackButton from "../components/BackButton.jsx";
import { Link } from "react-router-dom";
import { shortWallet } from "../lib/walletUi";

function supabaseHeaders() {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    apikey: anon,
    authorization: `Bearer ${anon}`,
    "x-supabase-client-platform": "winter-arcade-web",
  };
}

export default function WallOfFame() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [winner, setWinner] = useState(null);
  const [top20, setTop20] = useState([]);
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const url = `${baseUrl}/functions/v1/wall-of-fame`;

        const res = await fetch(url, {
          method: "GET",
          headers: supabaseHeaders(),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || `wall-of-fame failed (${res.status})`);
        }

        if (!mounted) return;

        setFrozen(Boolean(data?.frozen));
        setWinner(data?.winner ?? null);
        setTop20(Array.isArray(data?.top20) ? data.top20 : []);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Wall of Fame load error");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card">
      <BackButton to="/arcade" label="← Back to Arcade" />
      <h2 className="h2">🏆 Wall of Fame</h2>

      <Link className="btn" to="/winner" style={{ marginTop: 10 }}>
        🏅 View Winner
      </Link>

      {loading && <p className="p">Loading…</p>}
      {err && (
        <p className="p" style={{ color: "tomato" }}>
          {err}
        </p>
      )}

      {!loading && !err && (
        <>
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>
              🥇 Winner{" "}
              {frozen ? (
                <span style={{ fontSize: 12, opacity: 0.85 }}>(Official / Frozen)</span>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.85 }}>(Live)</span>
              )}
            </h3>

            {winner ? (
              <div>
                <div>
                  <strong>Wallet:</strong> {shortWallet(winner.wallet || "—")}
                </div>
                <div>
                  <strong>Snowball Frenzy:</strong> {winner.best_snowball}
                </div>
              </div>
            ) : (
              <div>No data yet.</div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Top 20</h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "8px 6px" }}>#</th>
                    <th style={{ padding: "8px 6px" }}>Wallet</th>
                    <th style={{ padding: "8px 6px" }}>Snowball</th>
                  </tr>
                </thead>

                <tbody>
                  {top20.map((row, i) => (
                    <tr
                      key={`${row.wallet || "—"}-${i}`}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: "8px 6px" }}>{i + 1}</td>
                      <td style={{ padding: "8px 6px" }}>{shortWallet(row.wallet || "—")}</td>
                      <td style={{ padding: "8px 6px" }}>{row.best_snowball}</td>
                    </tr>
                  ))}

                  {top20.length === 0 && (
                    <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "8px 6px" }} colSpan={3}>
                        No data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
              {frozen
                ? "Leaderboard is frozen: positions are final."
                : "Leaderboard is live: positions may change until frozen."}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

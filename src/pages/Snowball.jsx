// src/pages/Snowball.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import BackButton from "../components/BackButton.jsx";
import { submitScore as submitScoreApi } from "../lib/scoreApi";
import { fetchTopScores } from "../lib/leaderboardApi";
import { useWallet } from "@solana/wallet-adapter-react";
import { checkHolderAccess, getGateConfig } from "../lib/gating.js";

export default function Snowball() {
  const { publicKey, connected } = useWallet();

  const GAME_KEY = "snowball";
  const gameUrl = `${import.meta.env.BASE_URL}games/snowball/index.html`;
  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  // Leaderboard
  const [leaders, setLeaders] = useState([]);
  const [lbStatus, setLbStatus] = useState("idle");

  // Auto submit
  const [autoStatus, setAutoStatus] = useState("");
  const lastSubmittedRef = useRef(null);

  // Gating state
  const [gate, setGate] = useState({
    enabled: false,
    loading: false,
    ok: true,
    allowed: true,
    balanceUi: 0,
    threshold: 0,
    error: "",
    program: "",
  });

  async function loadLeaderboard() {
    try {
      setLbStatus("loading");
      const rows = await fetchTopScores(GAME_KEY, 10);
      setLeaders(rows);
      setLbStatus("ok");
    } catch (e) {
      console.error("Leaderboard load error:", e);
      setLbStatus("error");
    }
  }

  useEffect(() => {
    const cfg = getGateConfig();
    setGate((g) => ({
      ...g,
      enabled: cfg.enabled,
      threshold: cfg.threshold,
    }));

    if (!connected || !wallet) return;

    let cancelled = false;
    (async () => {
      setGate((g) => ({ ...g, loading: true, error: "" }));
      const res = await checkHolderAccess(wallet);
      if (cancelled) return;

      if (!res.ok) {
        setGate((g) => ({
          ...g,
          loading: false,
          ok: false,
          allowed: false,
          error: res.error || "gating failed",
          program: "",
          balanceUi: 0,
        }));
        return;
      }

      setGate((g) => ({
        ...g,
        loading: false,
        ok: true,
        allowed: res.allowed,
        balanceUi: res.balanceUi,
        threshold: res.threshold,
        error: "",
        program: res.program || "",
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, wallet]);

  useEffect(() => {
    function onMessage(e) {
      if (!e.data || typeof e.data !== "object") return;

      const { type, game, score } = e.data;
      if (type !== "WINTER_ARCADE_SCORE") return;
      if (game !== GAME_KEY) return;

      const s = Number(score);
      if (!Number.isFinite(s) || s < 0) return;

      if (!connected || !wallet) {
        setAutoStatus("Score received, but wallet not connected.");
        return;
      }

      if (gate.enabled && !gate.allowed) {
        setAutoStatus(`Holders-only: blocked ⛔ (need ${gate.threshold} tokens).`);
        return;
      }

      const sig = `${wallet}:${GAME_KEY}:${s}`;
      if (lastSubmittedRef.current === sig) return;
      lastSubmittedRef.current = sig;

      (async () => {
        try {
          setAutoStatus(`Auto-submitting score: ${s}...`);
          const res = await submitScoreApi({ wallet, game: GAME_KEY, score: s });

          if (res?.ok) {
            setAutoStatus(
              res.accepted
                ? `Auto: accepted ✅ (new best: ${res.current_best ?? res.data?.score ?? s})`
                : `Auto: not improved (best: ${res.current_best ?? "—"})`
            );
            await loadLeaderboard();
          } else {
            setAutoStatus("Auto: submit failed.");
          }
        } catch (err) {
          console.error("Auto submit error:", err);
          setAutoStatus("Auto: submit failed (see console).");
        }
      })();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [connected, wallet, gate.enabled, gate.allowed, gate.threshold]);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const canPlay = connected && wallet && (!gate.enabled || gate.allowed);

  return (
    <div style={{ width: "100%", maxWidth: "none" }}>
      <div style={{ padding: "14px 16px 10px" }}>
        <BackButton to="/arcade" label="← Back to Arcade" />
        <h2 className="h2" style={{ marginTop: 10 }}>
          ❄️ Snowball Frenzy
        </h2>

        {!connected ? (
          <div style={{ marginTop: 10 }}>
            <p className="p">Connect your wallet (top-right) to play.</p>
          </div>
        ) : (
          <>
            <p className="p" style={{ marginTop: 8, opacity: 0.85 }}>
              Wallet: <b>{wallet || "—"}</b>
            </p>

            {gate.enabled ? (
              <p className="p" style={{ marginTop: 6, opacity: 0.85 }}>
                Access: {gate.loading ? "checking…" : gate.allowed ? "allowed ✅" : "blocked ⛔"}{" "}
                {!gate.loading ? (
                  <span style={{ opacity: 0.8 }}>
                    (balance: {gate.balanceUi} / {gate.threshold}
                    {gate.program ? ` — ${gate.program}` : ""})
                  </span>
                ) : null}
                {gate.error ? <span style={{ color: "#ffb4b4" }}> — {gate.error}</span> : null}
              </p>
            ) : (
              <p className="p" style={{ marginTop: 6, opacity: 0.7 }}>
                Access: DEV MODE (mint not set yet) ✅
              </p>
            )}
          </>
        )}
      </div>

      <div
        style={{
          width: "100%",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.15)",
        }}
      >
        {canPlay ? (
          <iframe
            title="Snowball Frenzy Game"
            src={gameUrl}
            style={{
              width: "100%",
              height: "calc(100dvh - 220px)",
              minHeight: 520,
              border: "0",
              display: "block",
            }}
            sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div style={{ padding: 18 }}>
            <div
              style={{
                maxWidth: 780,
                margin: "0 auto",
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              <p className="p" style={{ margin: 0 }}>
                {connected
                  ? `Holders-only: requires ${gate.threshold} tokens to play.`
                  : "Connect your wallet to play."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px 18px" }}>
        {autoStatus ? (
          <p className="p" style={{ marginTop: 0, opacity: 0.85 }}>
            {autoStatus}
          </p>
        ) : null}

        <details open style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", userSelect: "none" }}>
            <span className="p" style={{ margin: 0, fontWeight: 900 }}>
              🏆 Leaderboard (Top 10)
            </span>
          </summary>

          <div style={{ marginTop: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <p className="p" style={{ margin: 0, opacity: 0.7 }}>
                Status: <b>{lbStatus}</b>
              </p>
              <button onClick={loadLeaderboard} style={{ padding: "8px 12px", borderRadius: 10, cursor: "pointer" }}>
                Reload
              </button>
            </div>

            <ol style={{ marginTop: 10 }}>
              {leaders.map((row, i) => (
                <li key={`${row.wallet}-${i}`}>
                  #{i + 1} — {String(row.wallet).slice(0, 4)}…{String(row.wallet).slice(-4)} → <b>{row.score}</b>
                </li>
              ))}
            </ol>

            {lbStatus === "ok" && leaders.length === 0 ? <p className="p">No scores yet.</p> : null}
          </div>
        </details>
      </div>
    </div>
  );
}

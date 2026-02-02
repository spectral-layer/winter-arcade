// src/pages/Snowball.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import BackButton from "../components/BackButton.jsx";
import { submitScore as submitScoreApi } from "../lib/scoreApi";
import { useWallet } from "@solana/wallet-adapter-react";
import { checkHolderAccess, getGateConfig } from "../lib/gating.js";

export default function Snowball() {
  const { publicKey, connected } = useWallet();

  const GAME_KEY = "snowball";
  const gameUrl = `${import.meta.env.BASE_URL}games/snowball/index.html`;

  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  // Manual test submit
  const [testScore, setTestScore] = useState(0);
  const [status, setStatus] = useState({ loading: false, msg: "" });

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
  });

  useEffect(() => {
    const cfg = getGateConfig();
    setGate((g) => ({ ...g, enabled: cfg.enabled, threshold: cfg.threshold }));

    if (!connected || !wallet) return;

    let cancelled = false;
    (async () => {
      setGate((g) => ({ ...g, loading: true, error: "" }));
      const res = await checkHolderAccess(wallet);
      if (cancelled) return;

      if (!res.ok) {
        setGate((g) => ({ ...g, loading: false, ok: false, allowed: false, error: res.error || "gating failed" }));
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
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, wallet]);

  useEffect(() => {
    function onMessage(e) {
      const isDev =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

      if (e.origin !== window.location.origin && !(isDev && e.origin === "null")) return;
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

      // ✅ blocca auto-submit se gating attivo e non allowed
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
                ? `Auto: accepted ✅ (new best: ${res.current_best})`
                : `Auto: not improved (best: ${res.current_best})`
            );
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

  const onSubmitTestScore = async () => {
    try {
      setStatus({ loading: true, msg: "" });

      if (!connected || !wallet) {
        setStatus({ loading: false, msg: "Connect your wallet first." });
        return;
      }

      // ✅ blocca manual submit se gating attivo e non allowed
      if (gate.enabled && !gate.allowed) {
        setStatus({ loading: false, msg: `Holders-only: need ${gate.threshold} tokens.` });
        return;
      }

      const scoreInt = Number.parseInt(String(testScore), 10);
      if (!Number.isFinite(scoreInt) || scoreInt < 0) {
        setStatus({ loading: false, msg: "Invalid score." });
        return;
      }

      const res = await submitScoreApi({
        wallet,
        game: GAME_KEY,
        score: scoreInt,
      });

      if (res?.ok) {
        setStatus({
          loading: false,
          msg: res.accepted
            ? `Score accepted ✅ (new best: ${res.current_best})`
            : `Not improved (current best: ${res.current_best})`,
        });
      } else {
        setStatus({ loading: false, msg: "Submit failed." });
      }
    } catch (e) {
      console.error("submitScore error:", e);
      setStatus({ loading: false, msg: "Submit failed (see console)." });
    }
  };

  return (
    <div className="card">
      <BackButton to="/arcade" label="← Back to Arcade" />
      <h2 className="h2">❄️ Snowball Frenzy</h2>

      {!connected ? (
        <div style={{ marginTop: 12 }}>
          <p className="p">
            This game is holders-only. Use the button in the top-right corner to connect your wallet.
          </p>
          <p className="p" style={{ opacity: 0.75 }}>
            (After launch, access will require the token threshold.)
          </p>
        </div>
      ) : (
        <>
          <p className="p" style={{ marginTop: 10, opacity: 0.85 }}>
            Wallet: <b>{wallet || "—"}</b>
          </p>

          {gate.enabled ? (
            <p className="p" style={{ marginTop: 8, opacity: 0.85 }}>
              Access: {gate.loading ? "checking…" : gate.allowed ? "allowed ✅" : "blocked ⛔"}{" "}
              {!gate.loading ? (
                <span style={{ opacity: 0.8 }}>
                  (balance: {gate.balanceUi} / {gate.threshold})
                </span>
              ) : null}
              {gate.error ? <span style={{ color: "#ffb4b4" }}> — {gate.error}</span> : null}
            </p>
          ) : (
            <p className="p" style={{ marginTop: 8, opacity: 0.7 }}>
              Access: DEV MODE (mint not set yet) ✅
            </p>
          )}

          {(!gate.enabled || gate.allowed) ? (
            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <iframe
                title="Snowball Frenzy Game"
                src={gameUrl}
                style={{ width: "100%", height: 520, border: "0", display: "block" }}
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)" }}>
              <p className="p" style={{ margin: 0 }}>
                Holders-only: requires <b>{gate.threshold}</b> tokens to play.
              </p>
            </div>
          )}

          {/* Manual test submit */}
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="p" style={{ margin: 0 }}>
                Test score:
              </span>
              <input
                type="number"
                value={testScore}
                onChange={(e) => setTestScore(e.target.value)}
                style={{
                  width: 140,
                  padding: "6px 8px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                }}
              />
            </label>

            <button
              onClick={onSubmitTestScore}
              disabled={status.loading || (gate.enabled && !gate.allowed)}
              style={{ padding: "8px 12px", borderRadius: 10, cursor: "pointer" }}
            >
              {status.loading ? "Submitting..." : "Submit score"}
            </button>

            {status.msg ? <span className="p" style={{ margin: 0, opacity: 0.9 }}>{status.msg}</span> : null}
          </div>

          {autoStatus ? (
            <p className="p" style={{ marginTop: 10, opacity: 0.85 }}>
              {autoStatus}
            </p>
          ) : null}

          <p className="p" style={{ marginTop: 10, opacity: 0.7 }}>
            Next step: the game will postMessage the score to the parent, and we auto-submit at game over.
          </p>
        </>
      )}
    </div>
  );
}

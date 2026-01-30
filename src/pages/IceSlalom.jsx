// src/pages/IceSlalom.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import BackButton from "../components/BackButton.jsx";
import { submitScore } from "../lib/scoreApi";
import { useWallet } from "@solana/wallet-adapter-react";

export default function IceSlalom() {
  const { publicKey, connected } = useWallet();

  // IMPORTANT: usa gli stessi game keys salvati in Supabase
  const GAME_KEY = "slalom";
  const gameUrl = `${import.meta.env.BASE_URL}games/ice-slalom/index.html`;

  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  // Manual test submit (finché il gioco non invia automaticamente)
  const [testScore, setTestScore] = useState(0);
  const [status, setStatus] = useState({ loading: false, msg: "" });

  // Auto submit status (da postMessage)
  const [autoStatus, setAutoStatus] = useState("");
  const lastSubmittedRef = useRef(null);

  // ✅ Step 1C: listener robusto postMessage
  useEffect(() => {
    function onMessage(e) {
      // DEBUG (puoi commentare dopo)
      // console.log("POSTMESSAGE RECEIVED:", e.origin, e.data);

      // Accetta solo stessa origin, tranne in DEV dove può essere "null"
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

      // evita doppio submit dello stesso punteggio
      const sig = `${wallet}:${GAME_KEY}:${s}`;
      if (lastSubmittedRef.current === sig) return;
      lastSubmittedRef.current = sig;

      (async () => {
        try {
          setAutoStatus(`Auto-submitting score: ${s}...`);
          const res = await submitScore({ wallet, game: GAME_KEY, score: s });

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
  }, [connected, wallet]);

  const onSubmitTestScore = async () => {
    try {
      setStatus({ loading: true, msg: "" });

      if (!connected || !wallet) {
        setStatus({ loading: false, msg: "Connect your wallet first." });
        return;
      }

      const scoreInt = Number.parseInt(String(testScore), 10);
      if (!Number.isFinite(scoreInt) || scoreInt < 0) {
        setStatus({ loading: false, msg: "Invalid score." });
        return;
      }

      const res = await submitScore({
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

      <h2 className="h2">⛷️ Ice Slalom</h2>

      {!connected ? (
        <div style={{ marginTop: 12 }}>
          <p className="p">
            This game is holders-only. Use the button in the top-right corner to connect your wallet.
          </p>
          <p className="p" style={{ opacity: 0.75 }}>
            (If you are connected but still blocked later, that will be the token threshold check.)
          </p>
        </div>
      ) : (
        <>
          <p className="p" style={{ marginTop: 10, opacity: 0.85 }}>
            Wallet: <b>{wallet || "—"}</b>
          </p>

          <div
            style={{
              marginTop: 12,
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <iframe
              title="Ice Slalom Game"
              src={gameUrl}
              style={{ width: "100%", height: 520, border: "0", display: "block" }}
              sandbox="allow-scripts allow-same-origin allow-pointer-lock"
              referrerPolicy="no-referrer"
            />
          </div>

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
              disabled={status.loading}
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

import { useEffect, useMemo, useState } from "react";
import BackButton from "../components/BackButton.jsx";
import { submitScore } from "../lib/scoreApi";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Snowball() {
  const { publicKey, connected } = useWallet();

  const GAME_KEY = "snowball";
  const gameUrl = `${import.meta.env.BASE_URL}games/snowball/index.html`;

  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  // Test manuale finché il gioco non invia lo score via postMessage
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState({ loading: false, msg: "" });

  // (Opzionale) ricezione score dal gioco via postMessage
  useEffect(() => {
    function onMessage(e) {
      if (!e?.data) return;
      if (e.data.type === "WINTER_ARCADE_SCORE" && e.data.game === GAME_KEY) {
        const s = Number(e.data.score || 0);
        if (!Number.isFinite(s) || s < 0) return;
        setScore(s);
        setStatus({ loading: false, msg: `Received score: ${s}` });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const onSubmitTestScore = async () => {
    try {
      setStatus({ loading: true, msg: "" });

      if (!connected || !wallet) {
        setStatus({ loading: false, msg: "Connect your wallet first." });
        return;
      }

      const scoreInt = Number.parseInt(String(score), 10);
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
        if (res.accepted) {
          setStatus({ loading: false, msg: `Score accepted ✅ (new best: ${res.current_best})` });
        } else {
          setStatus({ loading: false, msg: `Not improved (current best: ${res.current_best})` });
        }
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
              title="Snowball Frenzy Game"
              src={gameUrl}
              style={{ width: "100%", height: 520, border: "0", display: "block" }}
              sandbox="allow-scripts allow-pointer-lock"
              referrerPolicy="no-referrer"
            />
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="p" style={{ margin: 0 }}>Test score:</span>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
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

          <p className="p" style={{ marginTop: 10, opacity: 0.7 }}>
            Next step: the game will postMessage the score to the parent, and we auto-submit at game over.
          </p>
        </>
      )}
    </div>
  );
}

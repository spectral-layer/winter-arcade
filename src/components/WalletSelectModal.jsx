// WalletSelectModal.jsx
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "@solana/wallet-adapter-react";

export default function WalletSelectModal({ open, onClose }) {
  const {
    wallets,
    select,
    connect,
    connecting,
    connected,
    wallet, // <- wallet selezionato (o null)
  } = useWallet();

  const [pendingName, setPendingName] = useState(null);

  // ESC per chiudere
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Quando chiudi il modal, reset dello stato pending
  useEffect(() => {
    if (!open) setPendingName(null);
  }, [open]);

  // Connessione “robusta”: parte SOLO quando il wallet selezionato è davvero quello pending
  useEffect(() => {
    if (!open) return;
    if (!pendingName) return;
    if (connected) {
      // Se per qualche motivo sei già connesso, chiudi e basta
      onClose?.();
      setPendingName(null);
      return;
    }

    const selectedName = wallet?.adapter?.name || null;
    if (selectedName !== pendingName) return;

    let cancelled = false;

    const tryConnect = async (attempt = 0) => {
      try {
        // Se React/state non ha ancora propagato del tutto, questo evita il “primo click fallisce”
        await Promise.resolve();

        await connect();

        if (cancelled) return;
        onClose?.();
        setPendingName(null);
      } catch (e) {
        if (cancelled) return;

        const msg = String(e?.message || e || "");
        const isNotSelected =
          e?.name === "WalletNotSelectedError" || msg.includes("WalletNotSelectedError");

        // Micro-retry: dà tempo allo state del wallet-adapter di stabilizzarsi
        if (isNotSelected && attempt < 2) {
          setTimeout(() => tryConnect(attempt + 1), 80);
          return;
        }

        console.error("[WalletSelectModal] connect error:", e);
      }
    };

    tryConnect();

    return () => {
      cancelled = true;
    };
  }, [open, pendingName, wallet, connected, connect, onClose]);

  const list = useMemo(() => wallets || [], [wallets]);

  if (!open) return null;

  // PORTAL su body: evita tagli/offset strani dovuti a parent con overflow/transform/blur
  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(10,14,22,0.96)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          overflow: "hidden",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            flex: "0 0 auto",
          }}
        >
          <div style={{ fontWeight: 800 }}>Connect a wallet</div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: 14,
            display: "grid",
            gap: 10,
            overflow: "auto",
            flex: "1 1 auto",
          }}
        >
          {list.map((w, idx) => {
            const name = w?.adapter?.name || `wallet-${idx}`;
            const icon = w?.adapter?.icon;

            return (
              <button
                key={`${name}-${idx}`} // unico anche se compaiono doppioni “strani”
                onClick={() => {
                  try {
                    setPendingName(name);
                    select(name);
                    // NB: connect() NON qui: parte nell'useEffect quando wallet è davvero selezionato
                  } catch (e) {
                    console.error("[WalletSelectModal] select error:", e);
                  }
                }}
                disabled={connecting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: connecting ? "not-allowed" : "pointer",
                }}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ width: 28, height: 28 }} />
                )}

                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 800 }}>{name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {connecting && pendingName === name ? "Connecting…" : "Detected / available"}
                  </div>
                </div>

                <div style={{ marginLeft: "auto", opacity: 0.7 }}>›</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

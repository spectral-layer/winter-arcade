import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletSelectModal from "./WalletSelectModal";

export default function WalletToggleButton() {
  const { connected, publicKey, disconnect, connecting } = useWallet();
  const [open, setOpen] = useState(false);

  // Lock locale: evita doppio click durante disconnect/open modal
  const [busy, setBusy] = useState(false);

  const label = useMemo(() => {
    if (connecting || busy) return "Working…";
    if (!connected || !publicKey) return "Connect";
    const b58 = publicKey.toBase58();
    return `${b58.slice(0, 4)}…${b58.slice(-4)}`;
  }, [connected, publicKey, connecting, busy]);

  const handleClick = async () => {
    // evita click multipli mentre sta facendo connect/disconnect
    if (connecting || busy) return;

    setBusy(true);
    try {
      if (connected) {
        await disconnect();
        return;
      }

      // Non connesso -> apri modal
      setOpen(true);
    } catch (e) {
      console.warn("[WalletToggleButton] toggle error:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={connecting || busy}
        className="walletToggleBtn"
        style={{ minWidth: 120 }}
      >
        {label}
      </button>

      <WalletSelectModal
        open={open}
        onClose={() => {
          if (busy) return;
          setOpen(false);
        }}
      />
    </>
  );
}

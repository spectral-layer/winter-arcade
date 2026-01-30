import React, { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export default function WalletConnectButton({ className = "walletBtn" }) {
  const { wallet, connected, connecting, disconnect, connect, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  // Serve per capire quando l’utente ha appena cambiato wallet nella modal
  const prevWalletNameRef = useRef(null);

  // ✅ AUTO-CONNECT: appena selezioni Phantom/Solflare nella modal, parte subito connect()
  useEffect(() => {
    const name = wallet?.adapter?.name || null;

    // Se è cambiato wallet selezionato (es: da null -> Phantom)
    if (name && name !== prevWalletNameRef.current) {
      prevWalletNameRef.current = name;

      // Se non è già connesso e non sta già connettendo -> prova a connettere
      if (!connected && !connecting) {
        connect().catch(() => {
          // Se l’utente chiude Phantom o rifiuta, non facciamo crashare nulla
        });
      }
    }

    // Se non c’è wallet selezionato, resettiamo
    if (!name) prevWalletNameRef.current = null;
  }, [wallet, connected, connecting, connect]);

  const shortAddr = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : "";

  const label = connected
    ? shortAddr
    : wallet?.adapter?.name
      ? "Connect"
      : "Select Wallet";

  const handleClick = async () => {
    try {
      if (connected) {
        await disconnect();
        return;
      }

      // Se non hai ancora scelto un wallet -> apri modal
      if (!wallet) {
        setVisible(true);
        return;
      }

      // Se hai scelto un wallet ma non sei connesso -> connetti
      if (!connected && !connecting) {
        await connect();
      }
    } catch (e) {
      // Silenzioso: niente errori a schermo
    }
  };

  return (
    <button className={className} onClick={handleClick} disabled={connecting}>
      {label}
    </button>
  );
}

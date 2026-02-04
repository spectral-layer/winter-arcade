import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import App from "./App";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

const network = WalletAdapterNetwork.Mainnet;

const envRpc = import.meta.env.VITE_SOLANA_RPC_URL;

// ordered candidates (first wins)
const RPC_CANDIDATES = [
  envRpc,
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

// wallet adapters
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network })];

function pickRpc() {
  // Keep it deterministic: just pick the first candidate.
  // (If you want auto-probing later, we can add it, but keep it simple now.)
  return RPC_CANDIDATES[0];
}

const endpoint = pickRpc();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
);

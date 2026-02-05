// src/lib/gating.js
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function getEnvMint() {
  return String(import.meta.env.VITE_ACCESS_TOKEN_MINT || "").trim();
}

function getEnvThreshold() {
  const n = Number(import.meta.env.VITE_ACCESS_THRESHOLD || 0);
  return Number.isFinite(n) ? n : 0;
}

function getEnvGateEnabled() {
  const v = String(import.meta.env.VITE_GATE_ENABLED ?? "true").toLowerCase().trim();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

// Cache a single Connection
let _connection = null;
function getConnection() {
  if (!_connection) _connection = new Connection(RPC_URL, "confirmed");
  return _connection;
}

export function getGateConfig() {
  const mintStr = getEnvMint();
  const threshold = getEnvThreshold();
  const gateEnabled = getEnvGateEnabled();

  if (!gateEnabled) return { enabled: false, rpcUrl: RPC_URL, mint: "", threshold };

  if (!mintStr || threshold <= 0) {
    return { enabled: false, rpcUrl: RPC_URL, mint: "", threshold };
  }

  try {
    // eslint-disable-next-line no-new
    new PublicKey(mintStr);
  } catch {
    return { enabled: false, rpcUrl: RPC_URL, mint: "", threshold };
  }

  return { enabled: true, rpcUrl: RPC_URL, mint: mintStr, threshold };
}

/**
 * Returns:
 *  { ok:true, allowed:boolean, balanceUi:number, threshold:number, program:string }
 * or { ok:false, error:string }
 *
 * Robust: scans token accounts by owner (Token-2022 + classic) and sums balances for the mint.
 */
export async function checkHolderAccess(walletBase58) {
  try {
    const { enabled, mint, threshold } = getGateConfig();

    // DEV MODE: allow access
    if (!enabled) {
      return { ok: true, allowed: true, balanceUi: 0, threshold, program: "DEV" };
    }

    if (!walletBase58) return { ok: false, error: "missing wallet" };

    let owner, mintPk;
    try {
      owner = new PublicKey(walletBase58);
      mintPk = new PublicKey(mint);
    } catch {
      return { ok: false, error: "invalid wallet or mint" };
    }

    const connection = getConnection();

    const programsToTry = [
      { label: "TOKEN_2022", programId: TOKEN_2022_PROGRAM_ID },
      { label: "TOKEN_CLASSIC", programId: TOKEN_PROGRAM_ID },
    ];

    let totalUi = 0;
    let foundIn = [];

    for (const p of programsToTry) {
      try {
        const parsed = await connection.getParsedTokenAccountsByOwner(
          owner,
          { programId: p.programId },
          "confirmed"
        );

        for (const it of parsed.value) {
          const info = it.account?.data?.parsed?.info;
          if (!info) continue;

          const accMint = String(info.mint || "");
          if (accMint !== mintPk.toBase58()) continue;

          const tokenAmount = info.tokenAmount;
          const ui = Number(tokenAmount?.uiAmount ?? 0);
          if (Number.isFinite(ui) && ui > 0) totalUi += ui;

          foundIn.push(p.label);
        }
      } catch {
        // ignore and continue
      }
    }

    const allowed = totalUi >= threshold;

    return {
      ok: true,
      allowed,
      balanceUi: totalUi,
      threshold,
      program: foundIn.length ? Array.from(new Set(foundIn)).join("+") : "NONE",
    };
  } catch (e) {
    return { ok: false, error: e?.message || "gating error" };
  }
}

// src/lib/gating.js
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function getEnvMint() {
  return String(import.meta.env.VITE_ACCESS_TOKEN_MINT || "").trim();
}

function getEnvThreshold() {
  const n = Number(import.meta.env.VITE_ACCESS_THRESHOLD || 0);
  return Number.isFinite(n) ? n : 0;
}

// Cache a single Connection (faster + avoids re-creating per request)
let _connection = null;
function getConnection() {
  if (!_connection) _connection = new Connection(RPC_URL, "confirmed");
  return _connection;
}

// "enabled" should mean: mint exists AND is a valid PublicKey AND threshold > 0
export function getGateConfig() {
  const mintStr = getEnvMint();
  const threshold = getEnvThreshold();

  // DEV MODE if mint empty or threshold invalid
  if (!mintStr || threshold <= 0) {
    return { enabled: false, rpcUrl: RPC_URL, mint: "", threshold };
  }

  // If mint is not base58-valid, do NOT enable gating (avoid blocking the site)
  try {
    // just validate; we don't need the object here
    // eslint-disable-next-line no-new
    new PublicKey(mintStr);
  } catch {
    return { enabled: false, rpcUrl: RPC_URL, mint: "", threshold };
  }

  return { enabled: true, rpcUrl: RPC_URL, mint: mintStr, threshold };
}

/**
 * Returns:
 *  { ok:true, allowed:boolean, balanceUi:number, threshold:number }
 * or { ok:false, error:string }
 *
 * balanceUi is computed precisely from raw amount + decimals (not uiAmount float).
 */
export async function checkHolderAccess(walletBase58) {
  try {
    const { enabled, mint, threshold } = getGateConfig();

    // DEV MODE: allow access (site usable before launch)
    if (!enabled) {
      return { ok: true, allowed: true, balanceUi: 0, threshold };
    }

    if (!walletBase58) return { ok: false, error: "missing wallet" };

    let owner;
    let mintPk;
    try {
      owner = new PublicKey(walletBase58);
      mintPk = new PublicKey(mint);
    } catch {
      // If wallet/mint invalid, do NOT hard-block with cryptic errors
      return { ok: false, error: "invalid wallet or mint" };
    }

    const connection = getConnection();

    // Associated Token Account (ATA)
    const ata = await getAssociatedTokenAddress(mintPk, owner, false);

    // If ATA doesn't exist, getTokenAccountBalance will throw → treat as 0 balance
    const bal = await connection.getTokenAccountBalance(ata).catch(() => null);

    const amountStr = bal?.value?.amount ?? "0"; // raw integer as string
    const decimals = bal?.value?.decimals ?? 0;

    // Convert raw amount to UI number: amount / (10^decimals)
    // Use Number for display; precise compare using raw threshold in UI tokens is ok here.
    const amountRaw = BigInt(amountStr);
    const denom = 10n ** BigInt(decimals);

    // balanceUi as a JS number for UI (safe for typical SPL amounts; if huge, it may lose precision in display only)
    const balanceUi = Number(amountRaw) / Number(denom);

    return {
      ok: true,
      allowed: balanceUi >= threshold,
      balanceUi,
      threshold,
    };
  } catch (e) {
    return { ok: false, error: e?.message || "gating error" };
  }
}

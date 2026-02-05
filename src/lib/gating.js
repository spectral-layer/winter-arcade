// src/lib/gating.js
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

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

// Cache a single Connection (faster + avoids re-creating per request)
let _connection = null;
function getConnection() {
  if (!_connection) _connection = new Connection(RPC_URL, "confirmed");
  return _connection;
}

// "enabled" should mean: gateEnabled=true AND mint valid AND threshold > 0
export function getGateConfig() {
  const mintStr = getEnvMint();
  const threshold = getEnvThreshold();
  const gateEnabled = getEnvGateEnabled();

  if (!gateEnabled) return { enabled: false, rpcUrl: RPC_URL, mint: "", threshold };

  // DEV MODE if mint empty or threshold invalid
  if (!mintStr || threshold <= 0) {
    return { enabled: false, rpcUrl: RPC_URL, mint: "", threshold };
  }

  // If mint is not base58-valid, do NOT enable gating (avoid blocking the site)
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
 * Tries TOKEN_2022 first (common for pump.fun), then classic SPL.
 */
export async function checkHolderAccess(walletBase58) {
  try {
    const { enabled, mint, threshold } = getGateConfig();

    // DEV MODE: allow access (site usable before launch)
    if (!enabled) {
      return { ok: true, allowed: true, balanceUi: 0, threshold, program: "DEV" };
    }

    if (!walletBase58) return { ok: false, error: "missing wallet" };

    let owner;
    let mintPk;
    try {
      owner = new PublicKey(walletBase58);
      mintPk = new PublicKey(mint);
    } catch {
      return { ok: false, error: "invalid wallet or mint" };
    }

    const connection = getConnection();

    const programsToTry = [
      { label: "TOKEN_2022", tokenProgramId: TOKEN_2022_PROGRAM_ID },
      { label: "TOKEN_CLASSIC", tokenProgramId: TOKEN_PROGRAM_ID },
    ];

    for (const p of programsToTry) {
      try {
        const ata = await getAssociatedTokenAddress(
          mintPk,
          owner,
          false,
          p.tokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Se ATA non esiste -> getTokenAccountBalance lancia -> passiamo al prossimo program
        const bal = await connection.getTokenAccountBalance(ata);

        const amountStr = bal?.value?.amount ?? "0"; // raw integer as string
        const decimals = bal?.value?.decimals ?? 0;

        const amountRaw = BigInt(amountStr);
        const denom = 10n ** BigInt(decimals);

        const balanceUi = Number(amountRaw) / Number(denom);

        return {
          ok: true,
          allowed: balanceUi >= threshold,
          balanceUi,
          threshold,
          program: p.label,
        };
      } catch (e) {
        // prova prossimo programId
      }
    }

    return {
      ok: true,
      allowed: false,
      balanceUi: 0,
      threshold,
      program: "NONE",
    };
  } catch (e) {
    return { ok: false, error: e?.message || "gating error" };
  }
}

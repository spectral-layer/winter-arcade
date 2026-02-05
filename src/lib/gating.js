// src/lib/gating.js
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  getMint,
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
 *  { ok:true, allowed:boolean, balanceUi:number, threshold:number, program?:string }
 * or { ok:false, error:string }
 *
 * Supports BOTH Token-2022 and classic SPL tokens.
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
      return { ok: false, error: "invalid wallet or mint" };
    }

    const connection = getConnection();

    const programsToTry = [
      { label: "TOKEN_2022", programId: TOKEN_2022_PROGRAM_ID },
      { label: "TOKEN_CLASSIC", programId: TOKEN_PROGRAM_ID },
    ];

    for (const p of programsToTry) {
      try {
        // ATA depends on token programId
        const ata = await getAssociatedTokenAddress(
          mintPk,
          owner,
          false,
          p.programId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Fetch mint decimals using the same program
        const mintInfo = await getMint(connection, mintPk, undefined, p.programId);
        const decimals = mintInfo.decimals;

        // Fetch token account using the same program
        const tokenAcc = await getAccount(connection, ata, undefined, p.programId);

        const rawAmount = tokenAcc.amount; // bigint
        const uiAmount = Number(rawAmount) / Math.pow(10, decimals);

        return {
          ok: true,
          allowed: uiAmount >= threshold,
          balanceUi: uiAmount,
          threshold,
          program: p.label,
        };
      } catch (e) {
        // try next program
      }
    }

    // If no token account was found in either program
    return { ok: true, allowed: false, balanceUi: 0, threshold, program: "NONE" };
  } catch (e) {
    return { ok: false, error: e?.message || "gating error" };
  }
}

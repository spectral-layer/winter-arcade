// src/utils/TokenGating.js
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  getMint,
} from "@solana/spl-token";

/**
 * Ritorna { ok, uiAmount, needed, reason }
 * - ok: true se uiAmount >= threshold (in token "umani")
 */
export async function checkTokenGate(connection, walletPubkey, mintAddress, thresholdUi) {
  try {
    if (!connection) return { ok: false, uiAmount: 0, needed: thresholdUi, reason: "NO_CONNECTION" };
    if (!walletPubkey) return { ok: false, uiAmount: 0, needed: thresholdUi, reason: "NO_WALLET" };
    if (!mintAddress) return { ok: false, uiAmount: 0, needed: thresholdUi, reason: "NO_MINT" };

    const mint = new PublicKey(mintAddress);
    const owner = typeof walletPubkey === "string" ? new PublicKey(walletPubkey) : walletPubkey;

    const ata = await getAssociatedTokenAddress(mint, owner, false);

    // Leggo decimals dal mint
    const mintInfo = await getMint(connection, mint);
    const decimals = mintInfo.decimals;

    // Se l'account token non esiste, getAccount lancia: gestiamo come balance = 0
    let rawAmount = 0n;
    try {
      const tokenAcc = await getAccount(connection, ata);
      rawAmount = tokenAcc.amount; // bigint
    } catch (e) {
      // ATA inesistente => 0 token
      rawAmount = 0n;
    }

    // Converto in UI amount (numero con decimali)
    const uiAmount = Number(rawAmount) / Math.pow(10, decimals);

    const ok = uiAmount >= Number(thresholdUi);
    return { ok, uiAmount, needed: Number(thresholdUi), reason: ok ? "OK" : "INSUFFICIENT" };
  } catch (e) {
    console.error("[TokenGating] checkTokenGate error:", e);
    return { ok: false, uiAmount: 0, needed: thresholdUi, reason: "ERROR" };
  }
}

// src/lib/tokenGating.js
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/**
 * Ritorna { ok, uiAmount, needed, reason, program }
 * - ok: true se uiAmount >= threshold (in token "umani")
 */
export async function checkTokenGate(connection, walletPubkey, mintAddress, thresholdUi) {
  const needed = Number(thresholdUi ?? 0);

  try {
    if (!connection) return { ok: false, uiAmount: 0, needed, reason: "NO_CONNECTION" };
    if (!walletPubkey) return { ok: false, uiAmount: 0, needed, reason: "NO_WALLET" };
    if (!mintAddress) return { ok: false, uiAmount: 0, needed, reason: "NO_MINT" };

    const mint = new PublicKey(mintAddress);
    const owner = typeof walletPubkey === "string" ? new PublicKey(walletPubkey) : walletPubkey;

    // Pump.fun spesso usa Token-2022, ma teniamo fallback sul classic
    const programsToTry = [
      { label: "TOKEN_2022", programId: TOKEN_2022_PROGRAM_ID },
      { label: "TOKEN_CLASSIC", programId: TOKEN_PROGRAM_ID },
    ];

    for (const p of programsToTry) {
      try {
        // ATA dipende dal token programId
        const ata = await getAssociatedTokenAddress(
          mint,
          owner,
          false,
          p.programId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Decimals dal mint (stesso programId)
        const mintInfo = await getMint(connection, mint, undefined, p.programId);
        const decimals = mintInfo.decimals;

        // Token account (stesso programId)
        const tokenAcc = await getAccount(connection, ata, undefined, p.programId);

        const rawAmount = tokenAcc.amount; // bigint
        const uiAmount = Number(rawAmount) / Math.pow(10, decimals);

        const ok = uiAmount >= needed;
        return { ok, uiAmount, needed, reason: ok ? "OK" : "INSUFFICIENT", program: p.label };
      } catch (e) {
        // Provo il prossimo programId
      }
    }

    return { ok: false, uiAmount: 0, needed, reason: "TOKEN_ACCOUNT_NOT_FOUND" };
  } catch (e) {
    console.error("[TokenGating] checkTokenGate error:", e);
    return { ok: false, uiAmount: 0, needed, reason: "ERROR" };
  }
}

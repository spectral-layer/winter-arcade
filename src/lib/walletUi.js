// src/lib/walletUi.js
export function shortWallet(w) {
  if (!w) return "—";
  const s = String(w);
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function sameWallet(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

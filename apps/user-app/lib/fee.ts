/**
 * fee.ts — Frontend fee calculation
 * Must stay in sync with apps/worker/src/fee.js and SplitterFactory.sol
 */

const MIN_PRICE  = 0.02;   // $0.02
const FLAT_FEE   = 0.01;   // $0.01
const THRESHOLD  = 0.10;   // $0.10
const PCT_FEE    = 0.10;   // 10%

export const MIN_PRICE_UNITS = 20_000; // $0.02 in USDC units

export function calcFee(priceUsd: number): { youGet: number; fee: number; feeLabel: string } | null {
  if (priceUsd < MIN_PRICE) return null;
  const fee      = priceUsd < THRESHOLD ? FLAT_FEE : priceUsd * PCT_FEE;
  const feeLabel = priceUsd < THRESHOLD ? "$0.01" : "10%";
  return { youGet: priceUsd - fee, fee, feeLabel };
}

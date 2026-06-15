/**
 * fee.js — Platform fee logic
 * Single source of truth for fee calculation.
 *
 * Rules:
 *   $0.02–$0.09 → Turnpike gets $0.01 flat
 *   $0.10+      → Turnpike gets 10%
 *
 * All amounts in USDC units (6 decimal places).
 * Must stay in sync with SplitterFactory.sol fee parameters.
 */

const MIN_PRICE_UNITS = 20_000;   // $0.02
const FLAT_FEE_UNITS  = 10_000;   // $0.01
const THRESHOLD_UNITS = 100_000;  // $0.10
const PERCENT_FEE     = 0.10;     // 10%

export function calculateFee(priceUnits) {
  if (priceUnits < MIN_PRICE_UNITS) {
    throw new Error(`Minimum price is $0.02 (${MIN_PRICE_UNITS} units)`);
  }

  let platformFee;
  let feeLabel;

  if (priceUnits < THRESHOLD_UNITS) {
    // $0.02–$0.09: flat $0.01 fee
    platformFee = FLAT_FEE_UNITS;
    feeLabel    = "$0.01 fee";
  } else {
    // $0.10+: 10%
    platformFee = Math.round(priceUnits * PERCENT_FEE);
    feeLabel    = "10% fee";
  }

  const providerAmount = priceUnits - platformFee;

  return {
    platformFee,
    providerAmount,
    display: {
      price:       formatUsdc(priceUnits),
      platformFee: formatUsdc(platformFee),
      provider:    formatUsdc(providerAmount),
      feeLabel,
    },
  };
}

export function formatUsdc(units) {
  return "$" + (units / 1_000_000).toFixed(4).replace(/\.?0+$/, "");
}

export function dollarToUnits(dollarStr) {
  return Math.round(parseFloat(dollarStr) * 1_000_000);
}

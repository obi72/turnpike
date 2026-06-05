/**
 * fee.js — Platform fee logic
 * Single source of truth for fee calculation.
 *
 * Rules:
 *   Price $0.05+ → 15% platform fee
 *
 * All amounts in USDC units (6 decimal places).
 */

const MIN_PRICE_UNITS = 50000;   // $0.05
const PERCENT_FEE     = 0.15;

export function calculateFee(priceUnits) {
  if (priceUnits < MIN_PRICE_UNITS) {
    throw new Error(`Minimum price is $0.05 (${MIN_PRICE_UNITS} units)`);
  }

  const platformFee    = Math.round(priceUnits * PERCENT_FEE);
  const providerAmount = priceUnits - platformFee;

  return {
    platformFee,
    providerAmount,
    display: {
      price:       formatUsdc(priceUnits),
      platformFee: formatUsdc(platformFee),
      provider:    formatUsdc(providerAmount),
      feeLabel:    "15%",
    },
  };
}

export function formatUsdc(units) {
  return "$" + (units / 1_000_000).toFixed(4).replace(/\.?0+$/, "");
}

export function dollarToUnits(dollarStr) {
  return Math.round(parseFloat(dollarStr) * 1_000_000);
}

/**
 * fee.js — Platform fee logic
 * Single source of truth for fee calculation.
 *
 * Rules:
 *   Price $0.05–$0.09 → flat $0.01 platform fee
 *   Price $0.10+      → 10% platform fee
 *
 * All amounts in USDC units (6 decimal places).
 */

const MIN_PRICE_UNITS = 50000;   // $0.05
const FLAT_FEE_UNITS  = 10000;   // $0.01
const THRESHOLD_UNITS = 100000;  // $0.10
const PERCENT_FEE     = 0.10;

export function calculateFee(priceUnits) {
  if (priceUnits < MIN_PRICE_UNITS) {
    throw new Error(`Minimum price is $0.05 (${MIN_PRICE_UNITS} units)`);
  }

  let platformFee, model;
  if (priceUnits < THRESHOLD_UNITS) {
    platformFee = FLAT_FEE_UNITS;
    model       = "flat";
  } else {
    platformFee = Math.round(priceUnits * PERCENT_FEE);
    model       = "percent";
  }

  const providerAmount = priceUnits - platformFee;
  return {
    platformFee,
    providerAmount,
    model,
    display: {
      price:       formatUsdc(priceUnits),
      platformFee: formatUsdc(platformFee),
      provider:    formatUsdc(providerAmount),
      feeLabel:    model === "flat" ? "$0.01 flat fee" : "10%",
    },
  };
}

export function formatUsdc(units) {
  return "$" + (units / 1_000_000).toFixed(2);
}

export function dollarToUnits(dollarStr) {
  return Math.round(parseFloat(dollarStr) * 1_000_000);
}

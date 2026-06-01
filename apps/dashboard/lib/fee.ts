// Client-side fee calculation — mirrors worker/src/fee.js exactly.

const MIN_PRICE_UNITS = 50000;
const FLAT_FEE_UNITS  = 10000;
const THRESHOLD_UNITS = 100000;
const PERCENT_FEE     = 0.10;

export function calculateFee(priceUnits: number) {
  if (priceUnits < MIN_PRICE_UNITS) throw new Error("Minimum price is $0.05");

  const platformFee = priceUnits < THRESHOLD_UNITS
    ? FLAT_FEE_UNITS
    : Math.round(priceUnits * PERCENT_FEE);

  const model         = priceUnits < THRESHOLD_UNITS ? "flat" : "percent";
  const providerAmount = priceUnits - platformFee;

  return {
    platformFee, providerAmount, model,
    display: {
      price:       formatUsdc(priceUnits),
      platformFee: formatUsdc(platformFee),
      provider:    formatUsdc(providerAmount),
      feeLabel:    model === "flat" ? "$0.01 flat fee" : "10%",
    },
  };
}

export function formatUsdc(units: number) {
  return "$" + (units / 1_000_000).toFixed(2);
}

export function dollarToUnits(dollarStr: string) {
  return Math.round(parseFloat(dollarStr) * 1_000_000);
}

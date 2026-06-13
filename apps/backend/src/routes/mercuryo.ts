import { Router } from "express";
import { createHmac } from "crypto";

const router = Router();

const MERCURYO_WIDGET_BASE = process.env.MERCURYO_SANDBOX === "true"
  ? "https://sandbox-widget.mrcr.io"
  : "https://exchange.mercuryo.io";

function buildWidgetUrl(params: Record<string, string | number | undefined>): string {
  const widgetId = process.env.MERCURYO_WIDGET_ID;
  const secret   = process.env.MERCURYO_SECRET;
  if (!widgetId || !secret) throw new Error("Mercuryo not configured");

  const address   = String(params.address);
  const signature = createHmac("sha256", secret).update(address).digest("hex");

  const query = new URLSearchParams();
  query.set("widget_id", widgetId);
  query.set("signature", signature);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) query.set(k, String(v));
  }

  return `${MERCURYO_WIDGET_BASE}/?${query.toString()}`;
}

// Add Funds — onramp (fiat → USDC on Base)
router.post("/mercuryo/onramp-session", async (req, res) => {
  const { walletAddress, email, amount = 20 } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  try {
    const url = buildWidgetUrl({
      type:          "buy",
      currency:      "USDC",
      network:       "BASE",
      address:       walletAddress,
      fiat_currency: "EUR",
      fiat_amount:   amount,
      email:         email ?? undefined,
      theme:         "dark",
      lang:          "en",
      redirect_url:  "https://app.trnpk.net/dashboard",
    });
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Withdraw — offramp (USDC → fiat)
router.post("/mercuryo/offramp-session", async (req, res) => {
  const { walletAddress, email, amount } = req.body;
  if (!walletAddress || !amount) return res.status(400).json({ error: "walletAddress and amount required" });

  try {
    const url = buildWidgetUrl({
      type:           "sell",
      currency:       "USDC",
      network:        "BASE",
      address:        walletAddress,
      fiat_currency:  "EUR",
      crypto_amount:  amount,
      email:          email ?? undefined,
      theme:          "dark",
      lang:           "en",
      redirect_url:   "https://app.trnpk.net/dashboard",
    });
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from "express";

const router = Router();

const TRANSAK_API_STAGING = "https://api-gateway-stg.transak.com";
const TRANSAK_API_PROD    = "https://api-gateway.transak.com";

function transakApiBase() {
  const key = process.env.TRANSAK_API_KEY ?? "";
  // Staging keys typically used with staging gateway
  return TRANSAK_API_STAGING; // switch to PROD when going live
}

function transakWidgetBase() {
  return "https://global-stg.transak.com"; // switch to global.transak.com for production
}

async function createTransakSession(widgetParams: Record<string, any>): Promise<string> {
  const apiKey = process.env.TRANSAK_API_KEY;
  if (!apiKey) throw new Error("Transak not configured");

  const response = await fetch(`${transakApiBase()}/api/v2/auth/session`, {
    method: "POST",
    headers: {
      "accept":       "application/json",
      "content-type": "application/json",
      "access-token": apiKey,
    },
    body: JSON.stringify({
      widgetParams: {
        apiKey,
        referrerDomain: "app.trnpk.net",
        ...widgetParams,
      },
    }),
  });

  const data = await response.json() as any;
  if (!response.ok) throw new Error(data?.error ?? "Transak session error");

  const widgetUrl = data?.data?.widgetUrl;
  if (!widgetUrl) throw new Error("No widgetUrl in Transak response");
  return widgetUrl;
}

// Add Funds — onramp (fiat → crypto)
router.post("/transak/onramp-session", async (req, res) => {
  const { walletAddress, email, amount = 20 } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  try {
    const url = await createTransakSession({
      productsAvailed:       "BUY",
      cryptoCurrencyCode:    "USDC",
      network:               "base",
      walletAddress,
      email:                 email ?? "",
      fiatCurrency:          "EUR",
      fiatAmount:            amount,
      themeColor:            "000000",
      redirectURL:           "https://app.trnpk.net/dashboard",
      disableWalletAddressForm: true,
    });
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Withdraw — offramp (crypto → fiat)
router.post("/transak/offramp-session", async (req, res) => {
  const { walletAddress, email, amount } = req.body;
  if (!walletAddress || !amount) return res.status(400).json({ error: "walletAddress and amount required" });
  if (parseFloat(amount) < 10) return res.status(400).json({ error: "Minimum withdrawal is $10.00" });

  try {
    const url = await createTransakSession({
      productsAvailed:       "SELL",
      cryptoCurrencyCode:    "USDC",
      network:               "base",
      walletAddress,
      email:                 email ?? "",
      fiatCurrency:          "EUR",
      cryptoAmount:          amount,
      themeColor:            "000000",
      redirectURL:           "https://app.trnpk.net/dashboard",
    });
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

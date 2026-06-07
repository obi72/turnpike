import { Router } from "express";

const router = Router();

const TRANSAK_PARTNER_API = "https://api-stg.transak.com";
const TRANSAK_GATEWAY_API = "https://api-gateway-stg.transak.com";
const TRANSAK_WIDGET_BASE = "https://global-stg.transak.com";

// Cache access token in memory (valid 7 days)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const apiSecret = process.env.TRANSAK_API_SECRET;
  const apiKey    = process.env.TRANSAK_API_KEY;
  if (!apiSecret || !apiKey) throw new Error("Transak not configured");

  const response = await fetch(`${TRANSAK_PARTNER_API}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      "api-secret":   apiSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Transak token error: ${JSON.stringify(data)}`);
  }

  cachedAccessToken = data.data.accessToken;
  tokenExpiresAt    = data.data.expiresAt * 1000; // convert to ms if unix timestamp
  return cachedAccessToken!;
}

async function createTransakSession(widgetParams: Record<string, any>): Promise<string> {
  const apiKey      = process.env.TRANSAK_API_KEY;
  const accessToken = await getAccessToken();

  const response = await fetch(`${TRANSAK_GATEWAY_API}/api/v2/auth/session`, {
    method: "POST",
    headers: {
      "accept":        "application/json",
      "content-type":  "application/json",
      "access-token":  accessToken,
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
  if (!response.ok) {
    const msg = typeof data?.error === "string" ? data.error
      : typeof data?.message === "string" ? data.message
      : JSON.stringify(data);
    throw new Error(msg);
  }

  const widgetUrl = data?.data?.widgetUrl;
  if (!widgetUrl) throw new Error(`No widgetUrl in response: ${JSON.stringify(data)}`);
  return widgetUrl;
}

// Add Funds — onramp (fiat → crypto)
router.post("/transak/onramp-session", async (req, res) => {
  const { walletAddress, email, amount = 20 } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  try {
    const url = await createTransakSession({
      productsAvailed:          "BUY",
      cryptoCurrencyCode:       "USDC",
      network:                  "base",
      walletAddress,
      email:                    email ?? "",
      fiatCurrency:             "EUR",
      fiatAmount:               amount,
      themeColor:               "000000",
      redirectURL:              "https://app.trnpk.net/dashboard",
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
      productsAvailed:    "SELL",
      cryptoCurrencyCode: "USDC",
      network:            "base",
      walletAddress,
      email:              email ?? "",
      fiatCurrency:       "EUR",
      cryptoAmount:       amount,
      themeColor:         "000000",
      redirectURL:        "https://app.trnpk.net/dashboard",
    });
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

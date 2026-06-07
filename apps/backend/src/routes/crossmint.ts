import { Router } from "express";

const router = Router();

const CROSSMINT_BASE = "https://staging.crossmint.com/api/2022-06-09";

// Create Crossmint onramp order → returns orderId + clientSecret for embedded widget
router.post("/crossmint/order", async (req, res) => {
  const { walletAddress, email, amount = 20 } = req.body;

  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  const serverKey = process.env.CROSSMINT_SERVER_KEY;
  if (!serverKey) return res.status(500).json({ error: "Crossmint not configured" });

  try {
    const response = await fetch(`${CROSSMINT_BASE}/orders`, {
      method: "POST",
      headers: {
        "X-API-KEY":    serverKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment: {
          method:       "stripe-payment-element",
          currency:     "usd",
          receiptEmail: email ?? "",
        },
        lineItems: [{
          tokenLocator: `base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
          recipient: {
            walletAddress,
          },
          quantity: {
            amount: String(amount),
            currency: "usd",
          },
        }],
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      console.error("Crossmint order error:", data);
      return res.status(500).json({ error: data?.message ?? "Crossmint error" });
    }

    res.json({ orderId: data.order?.orderId ?? data.orderId, clientSecret: data.clientSecret ?? data.order?.clientSecret });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

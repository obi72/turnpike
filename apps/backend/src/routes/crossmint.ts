import { Router } from "express";

const router = Router();

const CROSSMINT_BASE = "https://staging.crossmint.com/api/2022-06-09";
// USDC on Base Sepolia (staging/test) — switch to base mainnet contract for production
const USDC_BASE = "base-sepolia:0x036CbD53842c5426634e7929541eC2318f3dCF7e";

router.post("/crossmint/order", async (req, res) => {
  const { walletAddress, email, amount = 20 } = req.body;

  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  const serverKey = process.env.CROSSMINT_SERVER_KEY;
  if (!serverKey) return res.status(500).json({ error: "Crossmint not configured" });

  try {
    const response = await fetch(`${CROSSMINT_BASE}/orders`, {
      method: "POST",
      headers: {
        "x-api-key":    serverKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lineItems: [{
          tokenLocator: USDC_BASE,
          executionParameters: {
            mode:   "exact-in",
            amount: String(amount),
          },
        }],
        payment: {
          method:       "card",
          receiptEmail: email ?? "",
        },
        recipient: {
          walletAddress: `base-sepolia:${walletAddress}`,
        },
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      console.error("Crossmint order error:", JSON.stringify(data));
      return res.status(500).json({ error: data?.message ?? "Crossmint error" });
    }

    res.json({
      orderId:      data.order?.orderId ?? data.orderId,
      clientSecret: data.clientSecret  ?? data.order?.clientSecret,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

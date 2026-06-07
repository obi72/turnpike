import { Router } from "express";

const router = Router();

// Create Stripe Crypto Onramp session via REST (SDK v14 has no stripe.crypto)
router.post("/stripe/onramp-session", async (req, res) => {
  const { walletAddress, amount } = req.body;

  if (!walletAddress || !amount) {
    return res.status(400).json({ error: "walletAddress and amount required" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  try {
    const params = new URLSearchParams({
      "transaction_details[destination_currency]":        "usdc",
      "transaction_details[destination_exchange_amount]": String(amount),
      "transaction_details[destination_network]":         "base",
      "transaction_details[wallet_addresses][base]":      walletAddress,
    });

    const response = await fetch("https://api.stripe.com/v1/crypto/onramp_sessions", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2022-11-15;crypto_onramp_beta=v1",
      },
      body: params.toString(),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      return res.status(500).json({ error: data?.error?.message ?? "Stripe error" });
    }

    res.json({ clientSecret: data.client_secret });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

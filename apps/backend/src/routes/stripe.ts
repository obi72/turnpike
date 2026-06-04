import { Router } from "express";
import Stripe from "stripe";

const router = Router();

// Create Stripe Crypto Onramp session
router.post("/stripe/onramp-session", async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { walletAddress, amount } = req.body;

  if (!walletAddress || !amount) {
    return res.status(400).json({ error: "walletAddress and amount required" });
  }

  try {
    // @ts-ignore — onramp sessions are in Stripe's crypto module
    const session = await (stripe as any).crypto.onrampSessions.create({
      transaction_details: {
        destination_currency:  "usdc",
        destination_exchange_amount: String(amount),
        destination_network: "base",
        wallet_addresses: { base: walletAddress },
      },
      customer_ip_address: req.ip,
    });
    res.json({ clientSecret: session.client_secret });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from "express";

const router = Router();

// Create Transak offramp session URL for publisher withdrawal
router.post("/transak/offramp-session", async (req, res) => {
  const { walletAddress, amount, email } = req.body;

  if (!walletAddress || !amount) {
    return res.status(400).json({ error: "walletAddress and amount required" });
  }
  if (parseFloat(amount) < 10) {
    return res.status(400).json({ error: "Minimum withdrawal is $10.00" });
  }

  const params = new URLSearchParams({
    apiKey:            process.env.TRANSAK_API_KEY!,
    defaultCryptoCurrency: "USDC",
    network:           "base",
    walletAddress,
    defaultFiatAmount: String(amount),
    email:             email ?? "",
    redirectURL:       "https://app.trnpk.net/dashboard",
    themeColor:        "000000",
    partnerCustomerId: walletAddress,
  });

  const url = `https://global.transak.com?${params.toString()}`;
  res.json({ url });
});

export default router;

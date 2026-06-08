import { Router } from "express";
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const router = Router();

const SPLIT_ABI = [
  {
    inputs: [],
    name: "split",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

router.post("/split", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { splitterAddress } = req.body;
  if (!splitterAddress) return res.status(400).json({ error: "splitterAddress required" });

  const privateKey = process.env.DEPLOY_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) return res.status(500).json({ error: "DEPLOY_PRIVATE_KEY not set" });

  try {
    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const walletClient = createWalletClient({ account, chain: base, transport: http() });

    const hash = await walletClient.writeContract({
      address: splitterAddress as `0x${string}`,
      abi: SPLIT_ABI,
      functionName: "split",
    });

    await publicClient.waitForTransactionReceipt({ hash });
    res.json({ ok: true, hash });
  } catch (err: any) {
    console.error("split() failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

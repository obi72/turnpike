import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const FACTORY_ADDRESS = process.env.SPLITTER_FACTORY_ADDRESS as `0x${string}` | undefined;
const DEPLOY_PRIVATE_KEY = process.env.DEPLOY_PRIVATE_KEY as `0x${string}` | undefined;

const FACTORY_ABI = [
  {
    inputs: [{ internalType: "address", name: "publisher", type: "address" }],
    name: "deploy",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Deploys a Splitter contract for a publisher via the on-chain SplitterFactory.
 * The Splitter receives USDC payments and splits them: platform fee → platform wallet, rest → publisher.
 */
export async function createSplitterWallet(
  publisherWallet: string,
  _platformWallet: string, // kept for API compatibility, platform address is baked into the contract
): Promise<string> {
  if (!FACTORY_ADDRESS) throw new Error("SPLITTER_FACTORY_ADDRESS not set");
  if (!DEPLOY_PRIVATE_KEY) throw new Error("DEPLOY_PRIVATE_KEY not set");

  const account = privateKeyToAccount(DEPLOY_PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const walletClient = createWalletClient({ account, chain: base, transport: http() });

  const hash = await walletClient.writeContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "deploy",
    args: [publisherWallet as `0x${string}`],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // The contract returns the splitter address — read it from the return value via simulateContract
  const splitterAddress = await publicClient.readContract({
    address: FACTORY_ADDRESS,
    abi: [
      {
        inputs: [{ internalType: "address", name: "publisher", type: "address" }],
        name: "splitters",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "splitters",
    args: [publisherWallet as `0x${string}`],
  });

  if (!splitterAddress || splitterAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Splitter deployment failed (tx: ${receipt.transactionHash})`);
  }

  return splitterAddress;
}

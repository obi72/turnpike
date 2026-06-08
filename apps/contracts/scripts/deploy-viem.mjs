import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLATFORM_WALLET = "0xE3221578f28C02c71D4F372ed1EAB7c1A33fB87e";
const USDC_ON_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRIVATE_KEY     = process.env.DEPLOY_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("Missing DEPLOY_PRIVATE_KEY env var");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: base, transport: http() });
const walletClient = createWalletClient({ account, chain: base, transport: http() });

const artifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/SplitterFactory.sol/SplitterFactory.json"), "utf8")
);

async function main() {
  console.log("Deploying from:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", formatEther(balance), "ETH");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [PLATFORM_WALLET, USDC_ON_BASE],
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("\n✅ SplitterFactory deployed to:", receipt.contractAddress);
  console.log("\nAdd to Railway env vars:");
  console.log(`SPLITTER_FACTORY_ADDRESS=${receipt.contractAddress}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

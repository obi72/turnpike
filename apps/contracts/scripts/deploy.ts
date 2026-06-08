import hre from "hardhat";

const PLATFORM_WALLET = "0xE3221578f28C02c71D4F372ed1EAB7c1A33fB87e" as `0x${string}`;
const USDC_ON_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  console.log("Deploying from:", deployer.account.address);

  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log("Balance:", Number(balance) / 1e18, "ETH");

  const factory = await hre.viem.deployContract("SplitterFactory", [PLATFORM_WALLET, USDC_ON_BASE]);

  console.log("\n✅ SplitterFactory deployed to:", factory.address);
  console.log("\nAdd to Railway env vars:");
  console.log(`SPLITTER_FACTORY_ADDRESS=${factory.address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

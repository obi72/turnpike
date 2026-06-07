import { ethers } from "hardhat";

const PLATFORM_WALLET = "0xE3221578f28C02c71D4F372ed1EAB7c1A33fB87e";
const USDC_ON_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("SplitterFactory");
  const factory = await Factory.deploy(PLATFORM_WALLET, USDC_ON_BASE);
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log("\n✅ SplitterFactory deployed to:", address);
  console.log("\nAdd to Railway env vars:");
  console.log(`SPLITTER_FACTORY_ADDRESS=${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

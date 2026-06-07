import { ethers } from "ethers";

// Generate a new operational wallet for backend contract calls
const wallet = ethers.Wallet.createRandom();
console.log("\n🔑 New operational wallet generated:");
console.log("Address:     ", wallet.address);
console.log("Private Key: ", wallet.privateKey);
console.log("\nSteps:");
console.log("1. Set DEPLOY_PRIVATE_KEY=" + wallet.privateKey + " in your local .env");
console.log("2. Fund", wallet.address, "with ~$2 of ETH on Base mainnet");
console.log("   (reicht für tausende Transaktionen bei ~$0.001/tx)");
console.log("3. Set BACKEND_SIGNER_KEY=" + wallet.privateKey + " in Railway");
console.log("4. Run: npx hardhat run scripts/deploy.ts --network base");

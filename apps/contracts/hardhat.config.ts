import "@nomicfoundation/hardhat-toolbox-viem";

const DEPLOY_PRIVATE_KEY = (process.env.DEPLOY_PRIVATE_KEY ?? ("0x" + "0".repeat(64))) as `0x${string}`;

export default {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    base: {
      type: "http",
      url: "https://mainnet.base.org",
      accounts: [DEPLOY_PRIVATE_KEY],
      chainId: 8453,
    },
    "base-sepolia": {
      type: "http",
      url: "https://sepolia.base.org",
      accounts: [DEPLOY_PRIVATE_KEY],
      chainId: 84532,
    },
  },
};

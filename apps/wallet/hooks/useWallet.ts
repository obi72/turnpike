"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";
import { base } from "wagmi/chains";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, token: USDC_ADDRESS });

  function login() {
    connect({
      connector: coinbaseWallet({
        appName:    "Turnpike",
        preference: "smartWalletOnly",
      }),
      chainId: base.id,
    });
  }

  async function getUsdcBalance(): Promise<number> {
    if (!balance) return 0;
    return parseFloat(balance.formatted);
  }

  return {
    address,
    isLoggedIn: isConnected,
    login,
    logout:         () => disconnect(),
    getUsdcBalance,
  };
}

"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connect }  = useConnect();
  const { disconnect } = useDisconnect();

  const { data: usdcBalance } = useBalance({
    address,
    token: USDC_ADDRESS,
  });

  function login() {
    connect({
      connector: coinbaseWallet({
        appName: "Turnpike",
        preference: "smartWalletOnly",
      }),
    });
  }

  async function getUsdcBalance(): Promise<number> {
    if (!usdcBalance) return 0;
    return parseFloat(usdcBalance.formatted);
  }

  return {
    address,
    isLoggedIn: isConnected,
    otpSent:    false,
    loading:    false,
    error:      null,
    login,
    logout:     disconnect,
    getUsdcBalance,
  };
}

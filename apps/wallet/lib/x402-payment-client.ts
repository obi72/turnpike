/**
 * x402 payment client — manual implementation using viem.
 *
 * Flow:
 *   1. Fetch pay URL → 402 with payment requirements
 *   2. Sign EIP-3009 transferWithAuthorization via Coinbase Smart Wallet
 *   3. Retry with X-PAYMENT header
 *   4. Receive content or redirect
 */

import { createWalletClient, custom, encodeFunctionData, parseUnits } from "viem";
import { base } from "viem/chains";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

// EIP-3009 transferWithAuthorization ABI
const TRANSFER_WITH_AUTH_ABI = [{
  name: "transferWithAuthorization",
  type: "function",
  inputs: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
    { name: "v",           type: "uint8"   },
    { name: "r",           type: "bytes32" },
    { name: "s",           type: "bytes32" },
  ],
  outputs: [],
}] as const;

export async function createPaymentClient(walletAddress: string) {
  return {
    async pay(payUrl: string): Promise<Response> {
      // Step 1: probe the URL to get payment requirements
      const probe = await fetch(payUrl, { method: "GET" });

      if (probe.status !== 402) {
        return probe; // already accessible (cached or free)
      }

      const requirements = await probe.json();
      const accept = requirements.accepts?.[0];
      if (!accept) throw new Error("No payment method available");

      const { maxAmountRequired, payTo, asset, extra } = accept;

      // Step 2: sign EIP-712 payment via browser wallet
      const walletClient = createWalletClient({
        account:   walletAddress as `0x${string}`,
        chain:     base,
        transport: custom((window as any).ethereum),
      });

      const validAfter  = BigInt(Math.floor(Date.now() / 1000) - 60);
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);
      const nonce       = crypto.getRandomValues(new Uint8Array(32));
      const nonceHex    = `0x${Array.from(nonce).map(b => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;

      const signature = await walletClient.signTypedData({
        domain: {
          name:              extra?.name ?? "USD Coin",
          version:           extra?.version ?? "2",
          chainId:           8453,
          verifyingContract: asset as `0x${string}`,
        },
        types: {
          TransferWithAuthorization: [
            { name: "from",        type: "address" },
            { name: "to",          type: "address" },
            { name: "value",       type: "uint256" },
            { name: "validAfter",  type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce",       type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from:        walletAddress as `0x${string}`,
          to:          payTo as `0x${string}`,
          value:       BigInt(maxAmountRequired),
          validAfter,
          validBefore,
          nonce:       nonceHex,
        },
      });

      // Step 3: encode payment header
      const payment = {
        x402Version: 1,
        scheme:      "exact",
        network:     "base",
        payload: {
          signature,
          authorization: {
            from:        walletAddress,
            to:          payTo,
            value:       maxAmountRequired.toString(),
            validAfter:  validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce:       nonceHex,
          },
        },
      };

      const paymentHeader = btoa(JSON.stringify(payment));

      // Step 4: retry with payment
      return fetch(payUrl, {
        headers: { "X-PAYMENT": paymentHeader },
      });
    },
  };
}

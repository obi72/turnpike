/**
 * x402 payment client — connects CDP Embedded Wallet to the x402 protocol.
 *
 * Flow:
 *   1. User visits pay.trnpk.net/slug
 *   2. Worker responds HTTP 402 + price
 *   3. This client signs a USDC transfer (1 CDP operation = $0.005)
 *   4. Retries the request with payment header
 *   5. Worker delivers content / issues 302 redirect
 */

import { createEthereumSigner } from "@coinbase/cdp-core";
import { createX402Client }     from "x402/client";

export async function createPaymentClient(walletAddress: string) {
  const signer = await createEthereumSigner({
    address: walletAddress as `0x${string}`,
  });

  const client = createX402Client({
    signer,
    network: "base-mainnet",
    asset:   "USDC",
  });

  return {
    async pay(payUrl: string): Promise<Response> {
      return client.fetch(payUrl);
    },
  };
}

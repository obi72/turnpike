/**
 * x402 payment client using CDP Embedded Wallet signer.
 *
 * Flow:
 *   1. Fetch pay URL → HTTP 402 with payment requirements
 *   2. CDP signer signs the payment via createPaymentHeader
 *   3. Retry with X-PAYMENT header
 *   4. Content is delivered
 */

import { createEthereumSigner } from "@coinbase/cdp-core";
import { createPaymentHeader, selectPaymentRequirements } from "x402/client";

export async function createPaymentClient(walletAddress: string) {
  const signer = await createEthereumSigner({
    address: walletAddress as `0x${string}`,
  });

  return {
    async pay(payUrl: string): Promise<Response> {
      // Step 1: probe to get 402
      const probe = await fetch(payUrl);
      if (probe.status !== 402) return probe;

      const body = await probe.json();
      const x402Version = body.x402Version ?? 1;

      // Step 2: select best payment option
      const requirements = selectPaymentRequirements(body.accepts, {
        network: "base",
        scheme:  "exact",
      });

      // Step 3: sign payment
      const paymentHeader = await createPaymentHeader(
        signer,
        x402Version,
        requirements,
      );

      // Step 4: retry with payment
      return fetch(payUrl, {
        headers: { "X-PAYMENT": paymentHeader },
      });
    },
  };
}

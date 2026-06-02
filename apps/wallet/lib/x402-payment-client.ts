/**
 * x402 payment client using wagmi wallet client for signing.
 */

import type { WalletClient } from "viem";
import { createPaymentHeader, selectPaymentRequirements } from "x402/client";

export async function createPaymentClient(walletClient: WalletClient) {
  return {
    async pay(payUrl: string): Promise<Response> {
      const probe = await fetch(payUrl);
      if (probe.status !== 402) return probe;

      const body        = await probe.json();
      const x402Version = body.x402Version ?? 1;
      const requirements = selectPaymentRequirements(body.accepts, "base", "exact");

      const paymentHeader = await createPaymentHeader(
        walletClient as any,
        x402Version,
        requirements,
      );

      return fetch(payUrl, {
        headers: { "X-PAYMENT": paymentHeader },
      });
    },
  };
}

/**
 * x402 payment client using CDP's built-in fetchWithX402.
 * The CDP embedded wallet signs the payment automatically.
 */

import { fetchWithX402 } from "@coinbase/cdp-core";

export async function createPaymentClient(_walletAddress: string) {
  return {
    async pay(payUrl: string): Promise<Response> {
      return fetchWithX402(payUrl);
    },
  };
}

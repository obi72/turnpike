/**
 * x402 payment client using CDP's fetchWithX402.
 * Signs USDC payments via the CDP embedded wallet automatically.
 */

import { fetchWithX402 } from "@coinbase/cdp-core";

export async function createPaymentClient(address: string) {
  const { fetchWithPayment } = fetchWithX402({ address });

  return {
    async pay(payUrl: string): Promise<Response> {
      return fetchWithPayment(payUrl);
    },
  };
}

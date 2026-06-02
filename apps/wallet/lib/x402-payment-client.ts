/**
 * x402 payment client using CDP embedded wallet.
 * fetchWithX402 from cdp-core handles signing automatically.
 */

import { fetchWithX402 } from "@coinbase/cdp-core";

export async function createPaymentClient(address: string) {
  const { fetchWithPayment } = fetchWithX402({ address });

  return {
    async pay(payUrl: string): Promise<Response> {
      return fetchWithPayment(payUrl) as Promise<Response>;
    },
  };
}

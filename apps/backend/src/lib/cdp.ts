const CDP_BASE = "https://api.cdp.coinbase.com/platform/v1";

export async function createUserWallet(): Promise<string> {
  const res = await fetch(`${CDP_BASE}/wallets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CDP_API_KEY}`,
    },
    body: JSON.stringify({ network_id: "base-mainnet" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CDP wallet creation failed: ${res.status} ${text}`);
  }
  const wallet = await res.json();
  return wallet.default_address.address_id as string;
}

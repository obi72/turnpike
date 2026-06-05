const CDP_BASE = "https://api.cdp.coinbase.com/platform/v1";

function b64url(input: string | ArrayBuffer): string {
  const b64 = typeof input === "string"
    ? Buffer.from(input).toString("base64")
    : Buffer.from(input).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function makeCdpJwt(method: string, url: string): Promise<string> {
  const keyB64 = process.env.CDP_API_KEY!;
  const keyName = `organizations/${process.env.CDP_PROJECT_ID}/apiKeys/${process.env.CDP_KEY_ID}`;

  const keyData    = Buffer.from(keyB64, "base64");
  const privateKey = await (globalThis as any).crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const now  = Math.floor(Date.now() / 1000);
  const { host, pathname } = new URL(url);
  const nonce = require("crypto").randomBytes(16).toString("hex");

  const header  = b64url(JSON.stringify({ alg: "ES256", kid: keyName, typ: "JWT", nonce }));
  const payload = b64url(JSON.stringify({
    sub: keyName, iss: "cdp",
    nbf: now, exp: now + 120, iat: now,
    uris: [`${method} ${host}${pathname}`],
  }));

  const sigInput = `${header}.${payload}`;
  const sig = await (globalThis as any).crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    Buffer.from(sigInput)
  );

  return `${sigInput}.${b64url(sig)}`;
}

async function cdpPost(url: string, body: object): Promise<any> {
  const jwt = await makeCdpJwt("POST", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CDP ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Creates a CDP splitter wallet for a publisher.
 * Sets up a webhook rule: 85% → providerWallet, 15% → platformWallet.
 * Called once when a user activates publisher mode.
 */
export async function createSplitterWallet(
  providerWallet: string,
  platformWallet: string,
): Promise<string> {
  // 1. Create wallet
  const wallet = await cdpPost(`${CDP_BASE}/wallets`, {
    wallet: { network_id: "base-mainnet" },
  });

  const splitterAddress = wallet.default_address.address_id as string;
  const walletId        = wallet.id as string;

  // 2. Set up 85/15 webhook rule
  await cdpPost(`${CDP_BASE}/wallets/${walletId}/webhook_rules`, {
    event_type: "erc20_transfer",
    asset:      "usdc",
    trigger:    "on_receive",
    actions: [
      { type: "transfer", to: providerWallet, percentage: 85, asset: "usdc", network_id: "base-mainnet" },
      { type: "transfer", to: platformWallet,  percentage: 15, asset: "usdc", network_id: "base-mainnet" },
    ],
  });

  return splitterAddress;
}

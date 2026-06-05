const CDP_BASE = "https://api.cdp.coinbase.com/platform/v1";

function b64url(input: string | ArrayBuffer): string {
  const b64 = typeof input === "string"
    ? Buffer.from(input).toString("base64")
    : Buffer.from(input).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function makeCdpJwt(method: string, url: string): Promise<string> {
  const keyId  = process.env.CDP_KEY_ID!;
  const keyB64 = process.env.CDP_API_KEY!;

  const keyData  = Buffer.from(keyB64, "base64");
  const privateKey = await (globalThis as any).crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const { host, pathname } = new URL(url);

  const header  = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    sub: keyId, iss: "cdp",
    nbf: now, exp: now + 120, iat: now,
    uriref: `${method} ${host}${pathname}`,
  }));

  const sigInput = `${header}.${payload}`;
  const sig = await (globalThis as any).crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    Buffer.from(sigInput)
  );

  return `${sigInput}.${b64url(sig)}`;
}

export async function createUserWallet(): Promise<string> {
  const url = `${CDP_BASE}/wallets`;
  const jwt = await makeCdpJwt("POST", url);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
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

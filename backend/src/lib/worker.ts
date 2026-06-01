// Server-side proxy to the Cloudflare Worker API.
// Keeps ADMIN_SECRET out of the browser.

const WORKER_URL   = process.env.WORKER_URL   ?? "https://pay.trnpk.net";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

function headers(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${ADMIN_SECRET}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function listRoutes(ownerId: string) {
  const res = await fetch(`${WORKER_URL}/api/routes?ownerId=${ownerId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createRoute(body: {
  slug: string;
  secretUrl: string;
  price: string;
  description?: string;
  ownerId: string;
  providerWallet: string;
}) {
  const res = await fetch(`${WORKER_URL}/api/routes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteRoute(slug: string) {
  const res = await fetch(`${WORKER_URL}/api/files/${slug}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFileLimit(ownerId: string) {
  const res = await fetch(`${WORKER_URL}/api/files/limit?ownerId=${ownerId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function closeAccount(ownerId: string) {
  const res = await fetch(`${WORKER_URL}/api/account/close`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ ownerId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Server-side helper — calls the admin Cloudflare Worker.
 * SUPER_ADMIN_SECRET is injected here, never sent to the browser.
 */

const WORKER = process.env.ADMIN_WORKER_URL ?? "https://admin-worker.trnpk.net";
const SECRET = process.env.SUPER_ADMIN_SECRET ?? "";

export async function adminFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${WORKER}/api/admin${path}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin worker ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

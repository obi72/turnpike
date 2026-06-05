const WORKER_URL   = process.env.WORKER_URL!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function workerFetch(path: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ADMIN_SECRET}`,
      // Let fetch set Content-Type automatically for FormData (includes boundary)
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  return res;
}

export async function createPayLink(data: {
  slug: string;
  secretUrl: string;
  price: string;
  description?: string;
  ownerId: string;
  providerWallet: string;
  splitterAddress: string;
}) {
  const res = await workerFetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

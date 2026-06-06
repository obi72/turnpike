const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL ?? "https://api.trnpk.net";

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BACKEND}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export const api = {
  // email-only (cdp-hooks login) or userId+email (Google OAuth)
  syncUser: (email: string, walletAddress?: string, userId?: string) =>
    apiFetch("/users/sync", { method: "POST", body: JSON.stringify({ userId, email, walletAddress }) }),

  activatePublisher: (userId: string, walletAddress?: string) =>
    apiFetch(`/users/${userId}/activate-publisher`, { method: "POST", body: JSON.stringify({ walletAddress }) }),

  saveWallet: (userId: string, walletAddress: string, credentialId?: string) =>
    apiFetch(`/users/${userId}/wallet`, { method: "POST", body: JSON.stringify({ walletAddress, credentialId }) }),

  getPayLinks: (ownerId: string) =>
    apiFetch(`/paylinks?ownerId=${ownerId}`),

  createPayLink: (data: { secretUrl: string; price: string; description?: string; ownerId: string; providerWallet: string }) =>
    apiFetch("/paylinks", { method: "POST", body: JSON.stringify(data) }),

  deletePayLink: (slug: string, ownerId: string) =>
    apiFetch(`/paylinks/${slug}`, { method: "DELETE", body: JSON.stringify({ ownerId }) }),

  stripeOnrampSession: (walletAddress: string, amount: number) =>
    apiFetch("/stripe/onramp-session", { method: "POST", body: JSON.stringify({ walletAddress, amount }) }),

  transakOfframpSession: (walletAddress: string, amount: number, email?: string) =>
    apiFetch("/transak/offramp-session", { method: "POST", body: JSON.stringify({ walletAddress, amount, email }) }),
};

// Admin API client — calls the admin Cloudflare Worker via SUPER_ADMIN_SECRET.
// This runs server-side in Next.js API routes to keep the secret out of the browser.

const ADMIN_API_URL     = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "https://admin-api.trnpk.net";
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET ?? "";

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res  = await fetch(`${ADMIN_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${SUPER_ADMIN_SECRET}`,
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Admin API error");
  return data as T;
}

export const getStats        = ()              => apiFetch<Stats>("/api/admin/stats");
export const listOwners      = (search?: string) =>
  apiFetch<Owner[]>(`/api/admin/owners${search ? `?search=${search}` : ""}`);
export const getOwner        = (id: string)    => apiFetch<OwnerDetail>(`/api/admin/owners/${id}`);
export const deleteFile      = (slug: string)  => apiFetch<{ ok: boolean }>(`/api/admin/files/${slug}`, { method: "DELETE" });
export const deleteAllFiles  = (id: string)    => apiFetch<{ ok: boolean; deleted: number }>(`/api/admin/owners/${id}/files`, { method: "DELETE" });
export const suspendOwner    = (id: string)    => apiFetch<{ ok: boolean }>(`/api/admin/owners/${id}/suspend`, { method: "POST" });
export const unsuspendOwner  = (id: string)    => apiFetch<{ ok: boolean }>(`/api/admin/owners/${id}/unsuspend`, { method: "POST" });
export const closeOwner      = (id: string)    => apiFetch<{ ok: boolean }>(`/api/admin/owners/${id}`, { method: "DELETE" });
export const updateSlots     = (id: string, newLimit: number) =>
  apiFetch<{ ok: boolean }>(`/api/admin/owners/${id}/slots`, { method: "PATCH", body: JSON.stringify({ newLimit }) });

export interface Stats {
  totalOwners:    number;
  totalFiles:     number;
  suspendedCount: number;
}

export interface Owner {
  ownerId:      string;
  fileCount:    number;
  slotLimit:    number;
  lastActivity: number | null;
  status:       "active" | "suspended";
}

export interface OwnerDetail extends Owner {
  files: FileEntry[];
}

export interface FileEntry {
  slug:           string;
  fileName:       string;
  fileSize:       number;
  price:          string;
  createdAt:      number;
  daysUntilDelete: number;
  payUrl:         string;
}

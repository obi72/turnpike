// Admin API client — all calls go through the Next.js proxy at /api/admin/*
// The proxy adds the SUPER_ADMIN_SECRET server-side. Nothing secret in the browser.

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res  = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Admin API error");
  return data as T;
}

export const getStats        = ()               => apiFetch<Stats>("/stats");
export const listOwners      = (search?: string) =>
  apiFetch<Owner[]>(`/owners${search ? `?search=${encodeURIComponent(search)}` : ""}`);
export const getOwner        = (id: string)     => apiFetch<OwnerDetail>(`/owners/${id}`);
export const deleteFile      = (slug: string)   => apiFetch<{ ok: boolean }>(`/files/${slug}`, { method: "DELETE" });
export const deleteAllFiles  = (id: string)     => apiFetch<{ ok: boolean; deleted: number }>(`/owners/${id}/files`, { method: "DELETE" });
export const suspendOwner    = (id: string)     => apiFetch<{ ok: boolean }>(`/owners/${id}/suspend`, { method: "POST" });
export const unsuspendOwner  = (id: string)     => apiFetch<{ ok: boolean }>(`/owners/${id}/unsuspend`, { method: "POST" });
export const closeOwner      = (id: string)     => apiFetch<{ ok: boolean }>(`/owners/${id}`, { method: "DELETE" });
export const updateSlots     = (id: string, newLimit: number) =>
  apiFetch<{ ok: boolean }>(`/owners/${id}/slots`, { method: "PATCH", body: JSON.stringify({ newLimit }) });

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
  slug:            string;
  fileName:        string;
  fileSize:        number;
  price:           string;
  createdAt:       number;
  daysUntilDelete: number;
  payUrl:          string;
}

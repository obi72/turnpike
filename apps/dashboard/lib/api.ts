// Client-side API helpers for the publisher dashboard.
// All sensitive calls go through the backend (which proxies to the Worker).

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.trnpk.net";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("turnpike_token");
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res   = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      "Content-Type":  "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

// ── Auth ───────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; ownerId: string; email: string }>("/auth/login", {
    method: "POST",
    body:   JSON.stringify({ email, password }),
  });
  localStorage.setItem("turnpike_token",   data.token);
  localStorage.setItem("turnpike_ownerId", data.ownerId);
  localStorage.setItem("turnpike_email",   data.email);
  return data;
}

export async function signup(email: string, password: string, providerWallet: string) {
  const data = await apiFetch<{ token: string; ownerId: string; email: string }>("/auth/signup", {
    method: "POST",
    body:   JSON.stringify({ email, password, providerWallet }),
  });
  localStorage.setItem("turnpike_token",   data.token);
  localStorage.setItem("turnpike_ownerId", data.ownerId);
  localStorage.setItem("turnpike_email",   data.email);
  return data;
}

export function logout() {
  localStorage.removeItem("turnpike_token");
  localStorage.removeItem("turnpike_ownerId");
  localStorage.removeItem("turnpike_email");
}

export function getSession() {
  if (typeof window === "undefined") return null;
  const token   = localStorage.getItem("turnpike_token");
  const ownerId = localStorage.getItem("turnpike_ownerId");
  const email   = localStorage.getItem("turnpike_email");
  if (!token || !ownerId) return null;
  return { token, ownerId, email: email ?? "" };
}

// ── Publisher ──────────────────────────────────────────────────
export const getMe        = ()        => apiFetch<PublisherProfile>("/publishers/me");
export const getRoutes    = ()        => apiFetch<Route[]>("/publishers/me/routes");
export const getLimit     = ()        => apiFetch<FileLimit>("/publishers/me/limit");
export const deleteRoute  = (slug: string) =>
  apiFetch<{ ok: boolean }>(`/publishers/me/routes/${slug}`, { method: "DELETE" });
export const createRoute  = (body: CreateRouteBody) =>
  apiFetch<CreateRouteResult>("/publishers/me/routes", { method: "POST", body: JSON.stringify(body) });
export const updateWallet = (providerWallet: string) =>
  apiFetch<{ ok: boolean }>("/publishers/me/wallet", { method: "PATCH", body: JSON.stringify({ providerWallet }) });
export const closeAccount = () =>
  apiFetch<{ ok: boolean }>("/publishers/me", { method: "DELETE" });

// ── File upload with progress ──────────────────────────────────
export function uploadFile({
  file,
  ownerId,
  price,
  description,
  providerWallet,
  onProgress,
}: {
  file: File;
  ownerId: string;
  price: string;
  description?: string;
  providerWallet: string;
  onProgress?: (pct: number) => void;
}): Promise<UploadResult> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum 50 MB.`);
  }

  const form = new FormData();
  form.append("file",           file);
  form.append("ownerId",        ownerId);
  form.append("price",          price);
  form.append("description",    description ?? file.name);
  form.append("providerWallet", providerWallet);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status === 200) resolve(data);
      else reject(new Error(data.error ?? "Upload failed"));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("POST", `${BACKEND}/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${getToken()}`);
    xhr.send(form);
  });
}

// ── Types ──────────────────────────────────────────────────────
export interface PublisherProfile {
  id:              string;
  email:           string;
  provider_wallet: string;
  created_at:      string;
}

export interface Route {
  slug:           string;
  type:           "url" | "file";
  description:    string;
  fileName?:      string;
  fileSize?:      number;
  price:          string;
  providerGets:   string;
  feeLabel:       string;
  createdAt:      number;
  daysUntilDelete: number | null;
  payUrl:         string;
}

export interface FileLimit {
  allowed:   boolean;
  count:     number;
  max:       number;
  remaining: number;
}

export interface CreateRouteBody {
  slug:           string;
  secretUrl:      string;
  price:          string;
  description?:   string;
  providerWallet: string;
}

export interface CreateRouteResult {
  ok:               boolean;
  payUrl:           string;
  splitterAddress:  string;
  display:          { price: string; platformFee: string; provider: string; feeLabel: string };
}

export interface UploadResult {
  ok:      boolean;
  payUrl:  string;
  fileId:  string;
  fileName: string;
  display: { price: string; platformFee: string; provider: string; feeLabel: string };
}

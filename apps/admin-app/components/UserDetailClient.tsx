"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "./ConfirmModal";

interface FileEntry {
  slug: string;
  fileName: string;
  fileSize: number;
  price: number;
  createdAt: number;
  daysUntilDelete: number;
  payUrl: string;
}

interface UserDetail {
  id: string;
  email: string;
  is_publisher: boolean;
  suspended: boolean;
  wallet_address: string | null;
  created_at: string;
  last_active_at: string;
  slotLimit: number;
  files: FileEntry[];
}

type ModalAction =
  | { type: "suspend" }
  | { type: "unsuspend" }
  | { type: "grant-publisher" }
  | { type: "revoke-publisher" }
  | { type: "delete-all-files" }
  | { type: "close-account" }
  | { type: "delete-file"; slug: string };

const MODAL_CONFIG: Record<string, {
  title: string;
  description: string;
  confirmLabel: string;
  severity: "danger" | "warning" | "success" | "blue";
}> = {
  suspend:          { title: "Suspend account", description: "The user cannot log in or make payments. Their data is preserved.", confirmLabel: "Suspend", severity: "warning" },
  unsuspend:        { title: "Unsuspend account", description: "Full access will be restored immediately.", confirmLabel: "Unsuspend", severity: "success" },
  "grant-publisher":  { title: "Grant publisher role", description: "User can immediately create pay links and sell content.", confirmLabel: "Grant", severity: "blue" },
  "revoke-publisher": { title: "Revoke publisher role", description: "Role removed. All files and pay links will be permanently deleted.", confirmLabel: "Revoke", severity: "danger" },
  "delete-all-files": { title: "Delete all files", description: "All uploaded files and pay links are permanently removed. The account stays active.", confirmLabel: "Delete all files", severity: "danger" },
  "close-account":    { title: "Close account", description: "All data is permanently deleted and cannot be recovered.", confirmLabel: "Close account", severity: "danger" },
  "delete-file":      { title: "Delete file", description: "This file and its pay link are permanently removed.", confirmLabel: "Delete", severity: "danger" },
};

export default function UserDetailClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [user, setUser]       = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<ModalAction | null>(null);
  const [acting, setActing]   = useState(false);
  const [newSlotLimit, setNewSlotLimit] = useState("");

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    setLoading(true);
    const res  = await fetch(`/api/admin/users/${userId}`);
    const data = await res.json();
    setUser(data);
    setNewSlotLimit(String(data?.slotLimit ?? 25));
    setLoading(false);
  }

  async function doAction(action: ModalAction) {
    setActing(true);
    try {
      if (action.type === "close-account") {
        await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
        router.push("/users");
        return;
      }
      if (action.type === "delete-file") {
        await fetch(`/api/admin/files/${action.slug}`, { method: "DELETE" });
      } else {
        await fetch(`/api/admin/users/${userId}/${action.type}`, { method: action.type === "delete-all-files" ? "DELETE" : "POST" });
      }
      setModal(null);
      await loadUser();
    } finally {
      setActing(false);
    }
  }

  async function updateSlots() {
    const n = parseInt(newSlotLimit);
    if (isNaN(n) || n < 1 || n > 1000) return;
    await fetch(`/api/admin/users/${userId}/slots`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newLimit: n }),
    });
    await loadUser();
  }

  if (loading) return <p style={{ color: "var(--text-3)" }}>Loading…</p>;
  if (!user)   return <p style={{ color: "var(--danger)" }}>User not found.</p>;

  const cfg = modal ? MODAL_CONFIG[modal.type] : null;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Confirm modal */}
      {modal && cfg && (
        <ConfirmModal
          title={cfg.title}
          description={cfg.description}
          targetEmail={user.email}
          confirmLabel={cfg.confirmLabel}
          severity={cfg.severity}
          loading={acting}
          onConfirm={() => doAction(modal)}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Back */}
      <button className="btn-ghost" style={{ fontSize: 12, marginBottom: 20 }} onClick={() => router.back()}>
        ← Back
      </button>

      {/* User header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{user.email}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <span className={`badge ${user.is_publisher ? "badge-blue" : "badge-gray"}`}>
              {user.is_publisher ? "Publisher" : "Consumer"}
            </span>
            <span className={`badge ${user.suspended ? "badge-red" : "badge-green"}`}>
              {user.suspended ? "Suspended" : "Active"}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>
          <p>Joined {new Date(user.created_at).toLocaleDateString()}</p>
          <p>Last active {user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "—"}</p>
          {user.wallet_address && (
            <p style={{ fontFamily: "monospace" }}>{user.wallet_address.slice(0, 8)}…</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 20,
      }}>
        <p style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
          Actions
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {/* Available to all roles */}
          {user.suspended ? (
            <button className="btn-success" onClick={() => setModal({ type: "unsuspend" })}>Unsuspend</button>
          ) : (
            <button className="btn-warning" onClick={() => setModal({ type: "suspend" })}>Suspend</button>
          )}

          {/* Role management */}
          {!user.is_publisher && (
            <button className="btn-primary" onClick={() => setModal({ type: "grant-publisher" })}>
              Grant publisher role
            </button>
          )}
          {user.is_publisher && (
            <>
              <button className="btn-ghost" onClick={() => setModal({ type: "revoke-publisher" })}>
                Revoke publisher role
              </button>
              <button className="btn-danger" onClick={() => setModal({ type: "delete-all-files" })}>
                Delete all files
              </button>
            </>
          )}

          {/* Nuclear */}
          <button className="btn-danger" onClick={() => setModal({ type: "close-account" })}>
            Close account
          </button>
        </div>
      </div>

      {/* Publisher-only: slots + files */}
      {user.is_publisher && (
        <>
          {/* Slot editor */}
          <div style={{
            background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 20,
          }}>
            <p style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
              File slot limit
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number" value={newSlotLimit} min={1} max={1000}
                onChange={e => setNewSlotLimit(e.target.value)}
                style={{ width: 80 }}
              />
              <button className="btn-primary" onClick={updateSlots}>Save</button>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                Currently using {user.files.length} / {user.slotLimit}
              </span>
            </div>
          </div>

          {/* File list */}
          <div style={{
            background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", overflow: "hidden",
          }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Files ({user.files.length})</p>
            </div>
            {user.files.length === 0 ? (
              <p style={{ padding: "20px", color: "var(--text-3)", fontSize: 13 }}>No files.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Price</th>
                    <th>Expires in</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {user.files.map(f => (
                    <tr key={f.slug}>
                      <td style={{ fontSize: 12 }}>
                        <p style={{ fontWeight: 500 }}>{f.fileName}</p>
                        <p style={{ color: "var(--text-3)", marginTop: 2 }}>/{f.slug}</p>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-2)" }}>
                        ${(f.price / 1_000_000).toFixed(2)}
                      </td>
                      <td style={{ fontSize: 12, color: f.daysUntilDelete <= 5 ? "var(--warning)" : "var(--text-2)" }}>
                        {f.daysUntilDelete}d
                      </td>
                      <td>
                        <button
                          style={{
                            fontSize: 12, padding: "3px 8px",
                            background: "transparent", border: "1px solid var(--danger)",
                            borderRadius: "var(--radius-sm)", color: "var(--danger)",
                          }}
                          onClick={() => setModal({ type: "delete-file", slug: f.slug })}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

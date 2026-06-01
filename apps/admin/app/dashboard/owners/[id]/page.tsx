"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getOwner, deleteFile, deleteAllFiles, suspendOwner, unsuspendOwner, updateSlots, type OwnerDetail } from "@/lib/api";

export default function OwnerDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [owner, setOwner]     = useState<OwnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSlots, setNewSlots] = useState("");
  const [acting, setActing]   = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("admin_secret")) { router.replace("/"); return; }
    load();
  }, [id, router]);

  async function load() {
    setLoading(true);
    try { setOwner(await getOwner(id)); }
    catch { router.replace("/dashboard"); }
    finally { setLoading(false); }
  }

  async function act(fn: () => Promise<any>) {
    setActing(true);
    try { await fn(); await load(); } finally { setActing(false); }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!owner)  return null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
      <Link href="/dashboard" style={{ fontSize: 12, color: "var(--text-2)" }}>← Back</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 24px" }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--mono)" }}>{owner.ownerId}</h1>
        <span className={`badge badge-${owner.status}`}>{owner.status}</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Files",       value: `${owner.files.length}/${owner.slotLimit}` },
          { label: "Last active", value: owner.lastActivity ? daysAgo(owner.lastActivity) : "never" },
          { label: "Status",      value: owner.status },
        ].map(({ label, value }) => (
          <div key={label} style={{ border: "0.5px solid var(--border-2)", borderRadius: "var(--radius)", padding: 12, textAlign: "center" }}>
            <p style={{ fontSize: 18, fontWeight: 600 }}>{value}</p>
            <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {owner.status === "active"
          ? <button className="warning" disabled={acting} onClick={() => act(() => suspendOwner(id))}>Suspend</button>
          : <button disabled={acting} onClick={() => act(() => unsuspendOwner(id))}>Unsuspend</button>
        }
        <button className="secondary" disabled={acting || owner.files.length === 0}
          onClick={() => { if (confirm("Delete ALL files for this publisher?")) act(() => deleteAllFiles(id)); }}>
          Delete all files
        </button>
        <button className="danger" disabled={acting}
          onClick={() => { if (confirm("Permanently close this account?")) act(() => router.push("/dashboard")); }}>
          Close account
        </button>
      </div>

      {/* Slot limit */}
      <div style={{ border: "0.5px solid var(--border-2)", borderRadius: "var(--radius)", padding: 16, marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>File slot limit (current: {owner.slotLimit})</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={newSlots} onChange={e => setNewSlots(e.target.value)}
            placeholder={owner.slotLimit.toString()} min="1" max="1000" style={{ width: 100 }} />
          <button disabled={acting || !newSlots} onClick={() => act(() => updateSlots(id, parseInt(newSlots)).then(() => setNewSlots("")))}>
            Update
          </button>
        </div>
      </div>

      {/* Files */}
      <h3 style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Files ({owner.files.length})
      </h3>
      {owner.files.length === 0
        ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No files.</p>
        : owner.files.map(f => (
          <div key={f.slug} style={{
            border: "0.5px solid var(--border-2)", borderRadius: "var(--radius)",
            padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.fileName}
              </p>
              <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                {(f.fileSize / 1024 / 1024).toFixed(1)} MB · {f.price} ·{" "}
                <span style={{ color: f.daysUntilDelete < 7 ? "var(--danger)" : "var(--text-3)" }}>
                  {f.daysUntilDelete}d until delete
                </span>
              </p>
            </div>
            <button className="danger" style={{ fontSize: 11, padding: "4px 8px" }} disabled={acting}
              onClick={() => { if (confirm(`Delete "${f.fileName}"?`)) act(() => deleteFile(f.slug)); }}>
              Delete
            </button>
          </div>
        ))
      }
    </div>
  );
}

function daysAgo(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days === 0 ? "today" : `${days}d ago`;
}

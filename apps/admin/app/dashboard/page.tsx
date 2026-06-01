"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats, listOwners, suspendOwner, unsuspendOwner, closeOwner, type Stats, type Owner } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [owners, setOwners]   = useState<Owner[]>([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load(q?: string) {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([getStats(), listOwners(q)]);
      setStats(s);
      setOwners(o);
    } catch { /* handle error */ }
    finally { setLoading(false); }
  }

  async function handleAction(action: "suspend" | "unsuspend" | "close", ownerId: string) {
    if (action === "close" && !confirm(`Permanently close account ${ownerId}? This is irreversible.`)) return;
    setActing(ownerId);
    try {
      if (action === "suspend")   await suspendOwner(ownerId);
      if (action === "unsuspend") await unsuspendOwner(ownerId);
      if (action === "close")     await closeOwner(ownerId);
      await load(search);
    } finally {
      setActing(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Turnpike Admin</h1>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>admin</span>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Publishers",  value: stats.totalOwners    },
            { label: "Files",       value: stats.totalFiles     },
            { label: "Suspended",   value: stats.suspendedCount },
          ].map(({ label, value }) => (
            <div key={label} style={{ border: "0.5px solid var(--border-2)", borderRadius: "var(--radius)", padding: 16, textAlign: "center" }}>
              <p style={{ fontSize: 26, fontWeight: 600 }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search publishers…" style={{ flex: 1 }}
          onKeyDown={e => e.key === "Enter" && load(search)} />
        <button onClick={() => load(search)}>Search</button>
        {search && <button className="secondary" onClick={() => { setSearch(""); load(); }}>Clear</button>}
      </div>

      {/* Owners table */}
      {loading ? <p style={{ color: "var(--text-2)" }}>Loading…</p> : (
        <div>
          {owners.map(o => (
            <div key={o.ownerId} style={{
              border: "0.5px solid var(--border-2)", borderRadius: "var(--radius)",
              padding: "12px 16px", marginBottom: 8,
              display: "flex", alignItems: "center", gap: 12,
              opacity: acting === o.ownerId ? 0.5 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link href={`/dashboard/owners/${o.ownerId}`} style={{ fontSize: 13, fontWeight: 500, fontFamily: "var(--mono)" }}>
                    {o.ownerId.slice(0, 16)}…
                  </Link>
                  <span className={`badge badge-${o.status}`}>{o.status}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                  {o.fileCount}/{o.slotLimit} files ·{" "}
                  {o.lastActivity ? `active ${daysAgo(o.lastActivity)}` : "never active"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {o.status === "active"
                  ? <button className="warning" onClick={() => handleAction("suspend", o.ownerId)}>Suspend</button>
                  : <button onClick={() => handleAction("unsuspend", o.ownerId)}>Unsuspend</button>
                }
                <button className="danger" onClick={() => handleAction("close", o.ownerId)}>Close</button>
              </div>
            </div>
          ))}
          {owners.length === 0 && <p style={{ color: "var(--text-2)" }}>No publishers found.</p>}
        </div>
      )}
    </div>
  );
}

function daysAgo(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days === 0 ? "today" : `${days}d ago`;
}

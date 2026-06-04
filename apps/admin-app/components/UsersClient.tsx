"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  is_publisher: boolean;
  suspended: boolean;
  fileCount: number;
  slotLimit: number;
  created_at: string;
  last_active_at: string;
}

type RoleFilter = "all" | "publisher" | "consumer" | "suspended";

export default function UsersClient() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [role, setRole]       = useState<RoleFilter>(
    (searchParams.get("role") as RoleFilter) ?? "all"
  );

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ role, ...(search ? { search } : {}) }).toString();
    const res = await fetch(`/api/admin/users?${qs}`);
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [role, search]);

  useEffect(() => { load(); }, [load]);

  function setRoleFilter(r: RoleFilter) {
    setRole(r);
    router.replace(`/users?role=${r}`, { scroll: false });
  }

  const tabs: { key: RoleFilter; label: string }[] = [
    { key: "all",       label: "All users"  },
    { key: "publisher", label: "Publishers" },
    { key: "consumer",  label: "Consumers"  },
    { key: "suspended", label: "Suspended"  },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Users</h1>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        {/* Role tabs */}
        <div style={{ display: "flex", gap: 2, background: "var(--bg-3)", borderRadius: "var(--radius-sm)", padding: 2 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setRoleFilter(t.key)}
              style={{
                padding: "5px 12px", fontSize: 12, borderRadius: "var(--radius-sm)",
                background: role === t.key ? "var(--bg-2)" : "transparent",
                color: role === t.key ? "var(--text)" : "var(--text-2)",
                border: role === t.key ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          placeholder="Search by email or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--text-3)" }}>Loading…</p>
      ) : (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Files</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.is_publisher ? "badge-blue" : "badge-gray"}`}>
                      {u.is_publisher ? "Publisher" : "Consumer"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.suspended ? "badge-red" : "badge-green"}`}>
                      {u.suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-2)" }}>
                    {u.is_publisher ? `${u.fileCount} / ${u.slotLimit}` : "—"}
                  </td>
                  <td style={{ color: "var(--text-2)", fontSize: 12 }}>
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "—"}
                  </td>
                  <td>
                    <Link href={`/users/${u.id}`}>
                      <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>View →</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

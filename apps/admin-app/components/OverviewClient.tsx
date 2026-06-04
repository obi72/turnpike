"use client";

import { useState, useEffect } from "react";

interface Stats {
  totalUsers: number;
  publishers: number;
  consumers: number;
  suspended: number;
  totalFiles: number;
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "18px 20px",
    }}>
      <p style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 30, fontWeight: 600 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

export default function OverviewClient() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--text-3)" }}>Loading…</p>;
  if (error)   return <p style={{ color: "var(--danger)" }}>Error: {error}</p>;
  if (!stats)  return null;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Overview</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
        <StatCard label="Total users"  value={stats.totalUsers} />
        <StatCard label="Publishers"   value={stats.publishers} sub={`${stats.consumers} consumers`} />
        <StatCard label="Total files"  value={stats.totalFiles} />
        <StatCard label="Suspended"    value={stats.suspended}  />
      </div>

      {stats.suspended > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "var(--radius)", padding: "14px 16px",
        }}>
          <p style={{ fontSize: 13, color: "var(--danger)" }}>
            ⚠ {stats.suspended} account{stats.suspended !== 1 ? "s" : ""} currently suspended.{" "}
            <a href="/users?role=suspended" style={{ color: "var(--danger)", textDecoration: "underline" }}>View</a>
          </p>
        </div>
      )}
    </div>
  );
}

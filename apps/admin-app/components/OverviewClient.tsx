"use client";

import { useState, useEffect } from "react";

interface Stats {
  totalUsers: number;
  publishers: number;
  consumers: number;
  suspended: number;
  totalFiles: number;
}

interface RevenueData {
  totalRevenue: number;
  totalFee: number;
  byPublisher: { email: string; revenue: number; fee: number; sales: number }[];
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

function fmt(units: number) {
  return "$" + (units / 1_000_000).toFixed(2);
}

export default function OverviewClient() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then(r => r.json()),
      fetch("/api/admin/revenue").then(r => r.json()),
    ])
      .then(([s, r]) => { setStats(s); setRevenue(r); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--text-3)" }}>Loading…</p>;
  if (error)   return <p style={{ color: "var(--danger)" }}>Error: {error}</p>;
  if (!stats)  return null;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Overview</h1>

      {/* User stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total users"  value={stats.totalUsers} />
        <StatCard label="Publishers"   value={stats.publishers} sub={`${stats.consumers} consumers`} />
        <StatCard label="Total files"  value={stats.totalFiles} />
        <StatCard label="Suspended"    value={stats.suspended}  />
      </div>

      {stats.suspended > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 24,
        }}>
          <p style={{ fontSize: 13, color: "var(--danger)" }}>
            ⚠ {stats.suspended} account{stats.suspended !== 1 ? "s" : ""} currently suspended.{" "}
            <a href="/users?role=suspended" style={{ color: "var(--danger)", textDecoration: "underline" }}>View</a>
          </p>
        </div>
      )}

      {/* Revenue summary */}
      {revenue && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard
              label="Total revenue"
              value={fmt(revenue.totalRevenue)}
              sub={`${revenue.byPublisher.reduce((s, p) => s + p.sales, 0)} paid purchases`}
            />
            <StatCard
              label="Turnpike earnings"
              value={fmt(revenue.totalFee)}
              sub={`${fmt(revenue.totalRevenue - revenue.totalFee)} to publishers`}
            />
          </div>

          {revenue.byPublisher.length > 0 && (
            <div style={{
              background: "var(--bg-2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Revenue by publisher</p>
              </div>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Publisher</th>
                    <th style={{ textAlign: "right" }}>Sales</th>
                    <th style={{ textAlign: "right" }}>Publisher receives</th>
                    <th style={{ textAlign: "right" }}>Turnpike</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.byPublisher.map(p => (
                    <tr key={p.email}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.email}</td>
                      <td style={{ textAlign: "right", color: "var(--text-2)" }}>{p.sales}</td>
                      <td style={{ textAlign: "right", color: "var(--success)" }}>{fmt(p.revenue - p.fee)}</td>
                      <td style={{ textAlign: "right", color: "var(--text-2)" }}>{fmt(p.fee)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

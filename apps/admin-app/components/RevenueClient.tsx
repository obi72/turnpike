"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  is_publisher: boolean;
  fileCount: number;
}

export default function RevenueClient() {
  const [publishers, setPublishers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users?role=publisher")
      .then(r => r.json())
      .then(d => setPublishers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  // Fee model: $0.01 flat for $0.05–$0.09, 10% for $0.10+
  // Revenue page shows fee model reference and top publishers by file count
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Revenue</h1>

      {/* Fee model reference */}
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "20px", marginBottom: 24,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Platform fee model</p>
        <table style={{ width: "auto" }}>
          <thead>
            <tr>
              <th style={{ paddingRight: 40 }}>Content price</th>
              <th style={{ paddingRight: 40 }}>Platform fee</th>
              <th>Publisher receives</th>
            </tr>
          </thead>
          <tbody>
            {[
              { price: "$0.05", fee: "$0.01 flat", publisher: "$0.04" },
              { price: "$0.09", fee: "$0.01 flat", publisher: "$0.08" },
              { price: "$0.10", fee: "$0.01 (10%)", publisher: "$0.09" },
              { price: "$0.25", fee: "$0.025 (10%)", publisher: "$0.225" },
              { price: "$1.00", fee: "$0.10 (10%)", publisher: "$0.90" },
              { price: "$5.00", fee: "$0.50 (10%)", publisher: "$4.50" },
            ].map(row => (
              <tr key={row.price}>
                <td style={{ fontFamily: "monospace" }}>{row.price}</td>
                <td style={{ color: "var(--text-2)" }}>{row.fee}</td>
                <td style={{ color: "var(--success)" }}>{row.publisher}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top publishers */}
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Publishers by file count</p>
        </div>
        {loading ? (
          <p style={{ padding: 20, color: "var(--text-3)" }}>Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Publisher</th>
                <th>Files</th>
              </tr>
            </thead>
            <tbody>
              {publishers
                .sort((a, b) => b.fileCount - a.fileCount)
                .map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.email}</td>
                    <td style={{ color: "var(--text-2)" }}>{p.fileCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

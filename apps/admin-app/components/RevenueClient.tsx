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

  // Fee model: 15% flat on all prices
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
              { price: "$0.05", fee: "$0.0075 (15%)", publisher: "$0.0425" },
              { price: "$0.10", fee: "$0.015 (15%)",  publisher: "$0.085"  },
              { price: "$0.25", fee: "$0.0375 (15%)", publisher: "$0.2125" },
              { price: "$1.00", fee: "$0.15 (15%)",   publisher: "$0.85"   },
              { price: "$5.00", fee: "$0.75 (15%)",   publisher: "$4.25"   },
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

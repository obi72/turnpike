"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

interface PayLink {
  slug: string;
  type: string;
  description: string;
  fileName?: string;
  price: string;
  providerGets: string;
  feeLabel: string;
  payUrl: string;
  daysUntilDelete: number | null;
}

export default function ContentList({ ownerId }: { ownerId: string }) {
  const [links, setLinks]     = useState<PayLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setLinks(await api.getPayLinks(ownerId)); }
    catch {}
    finally { setLoading(false); }
  }

  async function copyLink(url: string, slug: string) {
    await navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  }

  async function deleteLink(slug: string) {
    if (!confirm("Delete this pay link? This cannot be undone.")) return;
    await api.deletePayLink(slug, ownerId);
    setLinks(l => l.filter(x => x.slug !== slug));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Your pay links</h2>
        <Link href="/dashboard/publish">
          <button className="btn-primary" style={{ fontSize: 13, padding: "6px 14px" }}>+ New</button>
        </Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</p>
      ) : links.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 14 }}>
          No pay links yet.{" "}
          <Link href="/dashboard/publish" style={{ color: "var(--accent)" }}>Create your first</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map(link => (
            <div
              key={link.slug}
              style={{
                background: "var(--bg-2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "14px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                  {link.description}
                  {link.type === "file" && link.fileName && (
                    <span style={{ color: "var(--text-2)", fontWeight: 400 }}> · {link.fileName}</span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {link.price} · you get {link.providerGets} ({link.feeLabel})
                </p>
                {link.daysUntilDelete !== null && link.daysUntilDelete <= 7 && (
                  <p style={{ fontSize: 11, color: "var(--warning)", marginTop: 2 }}>
                    ⚠ Expires in {link.daysUntilDelete}d — needs a download to stay active
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => copyLink(link.payUrl, link.slug)}
                  style={{
                    fontSize: 12, padding: "5px 10px",
                    background: "var(--bg-3)", border: "1px solid var(--border-2)",
                    borderRadius: "var(--radius-sm)", color: "var(--text-2)",
                  }}
                >
                  {copied === link.slug ? "Copied!" : "Copy link"}
                </button>
                <button
                  onClick={() => deleteLink(link.slug)}
                  style={{
                    fontSize: 12, padding: "5px 10px",
                    background: "transparent", border: "1px solid var(--danger)",
                    borderRadius: "var(--radius-sm)", color: "var(--danger)",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { getRoutes, deleteRoute, type Route } from "@/lib/api";

export default function FilesPage() {
  const [routes, setRoutes]   = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied]   = useState<string | null>(null);

  useEffect(() => {
    getRoutes().then(setRoutes).finally(() => setLoading(false));
  }, []);

  async function handleDelete(slug: string) {
    if (!confirm(`Delete paywall "${slug}"? This cannot be undone.`)) return;
    setDeleting(slug);
    try {
      await deleteRoute(slug);
      setRoutes(r => r.filter(x => x.slug !== slug));
    } finally {
      setDeleting(null);
    }
  }

  function copyLink(url: string, slug: string) {
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  }

  const files = routes.filter(r => r.type === "file");
  const urls  = routes.filter(r => r.type === "url");

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 800 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>Files & Links</h2>
          <Link href="/dashboard/new"><button>+ New paywall</button></Link>
        </div>

        {loading ? <p style={{ color: "var(--text-2)" }}>Loading…</p> : (
          <>
            {routes.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <p style={{ color: "var(--text-2)", marginBottom: 16 }}>No paywalls yet.</p>
                <Link href="/dashboard/new"><button>Create first paywall</button></Link>
              </div>
            ) : (
              <>
                {files.length > 0 && (
                  <Section title="Files" routes={files}
                    deleting={deleting} copied={copied}
                    onDelete={handleDelete} onCopy={copyLink} />
                )}
                {urls.length > 0 && (
                  <Section title="URL Paywalls" routes={urls}
                    deleting={deleting} copied={copied}
                    onDelete={handleDelete} onCopy={copyLink} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Section({ title, routes, deleting, copied, onDelete, onCopy }: {
  title: string;
  routes: Route[];
  deleting: string | null;
  copied: string | null;
  onDelete: (slug: string) => void;
  onCopy: (url: string, slug: string) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
        {title}
      </h3>
      {routes.map(r => (
        <div key={r.slug} className="card" style={{ marginBottom: 8, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.description}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.payUrl}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{r.price}</p>
              {r.type === "file" && r.daysUntilDelete !== null && (
                <p style={{ fontSize: 10, color: r.daysUntilDelete < 7 ? "var(--danger)" : "var(--text-3)", marginTop: 2 }}>
                  {r.daysUntilDelete}d until expiry
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button className="secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                onClick={() => onCopy(r.payUrl, r.slug)}>
                {copied === r.slug ? "Copied!" : "Copy"}
              </button>
              <button className="danger" style={{ fontSize: 11, padding: "4px 10px" }}
                disabled={deleting === r.slug}
                onClick={() => onDelete(r.slug)}>
                {deleting === r.slug ? "…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

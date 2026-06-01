"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { getRoutes, getLimit, getMe, type Route, type FileLimit, type PublisherProfile } from "@/lib/api";

export default function DashboardOverview() {
  const [routes, setRoutes]   = useState<Route[]>([]);
  const [limit, setLimit]     = useState<FileLimit | null>(null);
  const [profile, setProfile] = useState<PublisherProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRoutes(), getLimit(), getMe()])
      .then(([r, l, p]) => { setRoutes(r); setLimit(l); setProfile(p); })
      .finally(() => setLoading(false));
  }, []);

  const fileCount = routes.filter(r => r.type === "file").length;
  const urlCount  = routes.filter(r => r.type === "url").length;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 800 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Overview</h2>

        {loading ? <p style={{ color: "var(--text-2)" }}>Loading…</p> : (
          <>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "File paywalls",    value: fileCount },
                { label: "URL paywalls",     value: urlCount  },
                { label: "Slots remaining",  value: limit ? `${limit.remaining}/${limit.max}` : "…" },
              ].map(({ label, value }) => (
                <div key={label} className="card" style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 28, fontWeight: 600 }}>{value}</p>
                  <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
              <Link href="/dashboard/new?type=file">
                <button>+ Upload file</button>
              </Link>
              <Link href="/dashboard/new?type=url">
                <button className="secondary">+ URL paywall</button>
              </Link>
            </div>

            {/* Recent content */}
            {routes.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <p style={{ color: "var(--text-2)", marginBottom: 16 }}>No paywalls yet. Create your first one.</p>
                <Link href="/dashboard/new"><button>Get started</button></Link>
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 12 }}>
                  Recent paywalls
                </h3>
                {routes.slice(0, 5).map(r => (
                  <RouteRow key={r.slug} route={r} />
                ))}
                {routes.length > 5 && (
                  <Link href="/dashboard/files" style={{ fontSize: 13, color: "var(--accent)" }}>
                    View all {routes.length} paywalls →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function RouteRow({ route }: { route: Route }) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8, padding: "14px 16px" }}>
      <span style={{
        fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
        background: route.type === "file" ? "#e8f0fe" : "#fdf0d5",
        color: route.type === "file" ? "#1a56db" : "#92400e",
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        {route.type}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {route.description}
      </span>
      <span style={{ fontSize: 13, color: "var(--text-2)" }}>{route.price}</span>
      <button
        className="secondary"
        style={{ fontSize: 11, padding: "4px 10px" }}
        onClick={() => { navigator.clipboard.writeText(route.payUrl); }}
      >
        Copy link
      </button>
    </div>
  );
}

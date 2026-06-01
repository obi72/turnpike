"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession, logout, getMe, type PublisherProfile } from "@/lib/api";

const NAV = [
  { href: "/dashboard",          label: "Overview" },
  { href: "/dashboard/new",      label: "New Content" },
  { href: "/dashboard/files",    label: "Files & Links" },
  { href: "/dashboard/earnings", label: "Earnings" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<PublisherProfile | null>(null);

  useEffect(() => {
    if (!getSession()) { router.replace("/"); return; }
    getMe().then(setProfile).catch(() => { logout(); router.replace("/"); });
  }, [router]);

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, flexShrink: 0,
        background: "var(--bg-secondary)",
        borderRight: "0.5px solid var(--border-2)",
        padding: "24px 0",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "0.5px solid var(--border-2)" }}>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>Turnpike</span>
        </div>

        <div style={{ padding: "16px 12px", flex: 1 }}>
          {NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} style={{
                display: "block", padding: "8px 10px", borderRadius: "var(--radius-sm)",
                fontSize: 13, fontWeight: active ? 500 : 400,
                color:      active ? "var(--text)" : "var(--text-2)",
                background: active ? "var(--bg)" : "transparent",
                marginBottom: 2,
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}>
                {label}
              </Link>
            );
          })}
        </div>

        <div style={{ padding: "16px 20px", borderTop: "0.5px solid var(--border-2)" }}>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile?.email ?? "…"}
          </p>
          <button onClick={handleLogout} className="secondary" style={{ width: "100%", fontSize: 12, padding: "7px 0" }}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}

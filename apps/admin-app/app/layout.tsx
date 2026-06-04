import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = { title: "Turnpike Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <nav style={{
          width: "var(--sidebar)", flexShrink: 0,
          background: "var(--bg-2)", borderRight: "1px solid var(--border)",
          padding: "24px 0", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "0 20px 24px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-2)" }}>
              TURNPIKE
            </p>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Admin</p>
          </div>
          <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { href: "/",        label: "Overview" },
              { href: "/users",   label: "All users" },
              { href: "/revenue", label: "Revenue" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                <div style={{
                  padding: "7px 10px", borderRadius: "var(--radius-sm)",
                  fontSize: 13, color: "var(--text-2)",
                }}>
                  {label}
                </div>
              </Link>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: "2rem", overflow: "auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}

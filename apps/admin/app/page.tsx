"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("admin_secret")) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "https://admin-api.trnpk.net"}/api/admin/stats`,
        { headers: { Authorization: `Bearer ${secret}` } },
      );
      if (res.ok) {
        sessionStorage.setItem("admin_secret", secret);
        router.push("/dashboard");
      } else {
        setError("Invalid secret.");
      }
    } catch {
      setError("Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-2)" }}>
      <div style={{ width: 320 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Turnpike Admin</h1>
        <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 20 }}>Enter SUPER_ADMIN_SECRET to continue.</p>
        <form onSubmit={handleSubmit}>
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
            placeholder="Super admin secret" style={{ width: "100%", marginBottom: 10 }} required />
          {error && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

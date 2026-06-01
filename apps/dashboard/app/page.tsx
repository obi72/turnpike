"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, signup, getSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]           = useState<"login" | "signup">("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [wallet, setWallet]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (getSession()) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, wallet);
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-secondary)",
    }}>
      <div style={{ width: 380, padding: "40px 0" }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px" }}>Turnpike</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>Publisher Dashboard</p>
        </div>

        <div className="card">
          {/* Mode toggle */}
          <div style={{
            display: "flex", background: "var(--bg-secondary)",
            borderRadius: "var(--radius-sm)", padding: 3, marginBottom: 20,
          }}>
            {(["login", "signup"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, background: mode === m ? "var(--bg)" : "transparent",
                color: mode === m ? "var(--text)" : "var(--text-2)",
                boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                padding: "7px 0", fontSize: 13,
              }}>
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <div className="label">Email</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="label">Password</div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters" minLength={8} required />
            </div>

            {mode === "signup" && (
              <div style={{ marginBottom: 14 }}>
                <div className="label">USDC Wallet Address (Base)</div>
                <input value={wallet} onChange={e => setWallet(e.target.value)}
                  placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$" required />
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  Your Base USDC wallet — 90% of revenue goes here.
                </p>
              </div>
            )}

            {error && <p className="error-msg">{error}</p>}

            <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 16 }}>
              {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

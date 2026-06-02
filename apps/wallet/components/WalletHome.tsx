"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://turnpike-production.up.railway.app";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("turnpike_token") : null;
}

export default function WalletHome() {
  const [view, setView]       = useState<"login" | "signup" | "home">("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [topup, setTopup]     = useState(5);

  useEffect(() => {
    if (getToken()) setView("home");
  }, []);

  useEffect(() => {
    if (view === "home") setBalance(0); // placeholder until real balance API exists
  }, [view]);

  async function handleSignup() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/user-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Signup failed");
      localStorage.setItem("turnpike_token", data.token);
      setView("home");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/user-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      localStorage.setItem("turnpike_token", data.token);
      setView("home");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("turnpike_token");
    setView("login");
    setEmail(""); setPassword("");
  }

  function openTopup() {
    alert("Credit card funding coming soon.");
  }

  const isAuthView = view === "login" || view === "signup";

  if (isAuthView) {
    return (
      <div style={{ maxWidth: 360, margin: "0 auto", padding: "60px 20px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Turnpike</h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32 }}>
          Pay for digital content instantly.
        </p>

        <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>Email</p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ marginBottom: 12 }}
        />

        <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>Password</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={view === "signup" ? "Min. 8 characters" : "Your password"}
          onKeyDown={e => {
            if (e.key === "Enter" && email && password) {
              view === "login" ? handleLogin() : handleSignup();
            }
          }}
          style={{ marginBottom: 16 }}
        />

        {view === "login" ? (
          <>
            <button onClick={handleLogin} disabled={loading || !email || !password} style={{ width: "100%" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 16, textAlign: "center" }}>
              No account?{" "}
              <span
                onClick={() => { setView("signup"); setError(null); }}
                style={{ color: "var(--accent)", cursor: "pointer" }}
              >
                Sign up
              </span>
            </p>
          </>
        ) : (
          <>
            <button onClick={handleSignup} disabled={loading || !email || password.length < 8} style={{ width: "100%" }}>
              {loading ? "Creating account…" : "Create account"}
            </button>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 16, textAlign: "center" }}>
              Already have an account?{" "}
              <span
                onClick={() => { setView("login"); setError(null); }}
                style={{ color: "var(--accent)", cursor: "pointer" }}
              >
                Sign in
              </span>
            </p>
          </>
        )}

        {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Turnpike</h1>
        <button
          onClick={handleLogout}
          style={{ width: "auto", padding: "6px 12px", fontSize: 12, background: "transparent", color: "var(--text-2)" }}
        >
          Sign out
        </button>
      </div>

      <div style={{
        background: "var(--bg-2)", borderRadius: "var(--radius)",
        padding: 24, textAlign: "center", marginBottom: 16,
      }}>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>Available balance</p>
        <p style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-1px" }}>
          {balance !== null ? `$${balance.toFixed(2)}` : "…"}
        </p>
      </div>

      <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Add funds</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[5, 10, 20, 50].map(amt => (
          <button key={amt} onClick={() => setTopup(amt)} style={{
            flex: 1, padding: "8px 0", fontSize: 13,
            background: topup === amt ? "var(--accent)" : "var(--bg-2)",
            color:      topup === amt ? "#fff"         : "var(--text-2)",
            border:     topup === amt ? "none"         : "0.5px solid var(--border-2)",
          }}>${amt}</button>
        ))}
      </div>
      <button onClick={openTopup} style={{ marginBottom: 28 }}>
        Add ${topup} with card
      </button>

      <div style={{ background: "var(--bg-2)", borderRadius: "var(--radius)", padding: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>How it works</p>
        {[
          "Top up your balance with a credit card",
          "Visit any Turnpike pay link",
          "Payment is processed automatically",
        ].map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, fontSize: 12, color: "var(--text-2)" }}>
            <span style={{ color: "var(--accent)", fontWeight: 500 }}>{i + 1}.</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

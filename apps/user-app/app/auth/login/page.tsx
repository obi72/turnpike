"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";

export default function LoginPage() {
  const supabase = createClient();

  const [mode, setMode]       = useState<"signin" | "signup">("signin");
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSent(true);
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  function switchMode(m: "signin" | "signup") {
    setMode(m); setError(null); setSent(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 360, padding: "2rem",
        background: "var(--bg-2)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      }}>
        {/* Tab toggle */}
        <div style={{ display: "flex", marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
          {(["signin", "signup"] as const).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: "10px 0", fontSize: 14, fontWeight: mode === m ? 600 : 400,
                background: "transparent", border: "none", cursor: "pointer",
                color: mode === m ? "var(--text-1)" : "var(--text-3)",
                borderBottom: mode === m ? "2px solid var(--text-1)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {sent ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Check your inbox</h1>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>
              We sent a link to {email}. Click it to continue.
            </p>
            <button type="button" className="btn-ghost" style={{ fontSize: 13, width: "100%" }}
              onClick={() => { setSent(false); setError(null); }}>
              ← Different email
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>
              {mode === "signin"
                ? "Enter your email — we'll send you a sign-in link."
                : "Enter your email to create a free account."}
            </p>

            <form onSubmit={handleSendLink} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email" placeholder="you@example.com"
                value={email} required autoFocus
                onChange={e => setEmail(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={loading || !email}>
                {loading ? "Sending…" : "Send link"}
              </button>
            </form>

            <div style={{ margin: "16px 0", textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>or</div>
            <button className="btn-ghost" style={{ width: "100%" }} onClick={handleGoogle}>
              Continue with Google
            </button>
          </>
        )}

        {error && <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{error}</p>}
      </div>
    </div>
  );
}

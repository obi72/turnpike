"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router   = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Check your email to confirm your account, then sign in.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 360, padding: "2rem",
        background: "var(--bg-2)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
          {isSignUp ? "Create account" : "Sign in"}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>
          {isSignUp ? "Start buying and selling content instantly." : "Welcome back."}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email} required
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="Password" value={password} required minLength={8}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <div style={{ margin: "16px 0", textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>or</div>

        <button className="btn-ghost" style={{ width: "100%" }} onClick={handleGoogle}>
          Continue with Google
        </button>

        {notice && <p style={{ marginTop: 12, fontSize: 13, color: "var(--success)" }}>{notice}</p>}
        {error  && <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{error}</p>}

        <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-2)", textAlign: "center" }}>
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button
            style={{ background: "none", padding: 0, color: "var(--accent)", fontSize: 12, border: "none" }}
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setNotice(null); }}
          >
            {isSignUp ? "Sign in" : "Create account"}
          </button>
        </p>
      </div>
    </div>
  );
}

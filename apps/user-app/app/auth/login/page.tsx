"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

function LoginForm() {
  const supabase     = createClient();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/dashboard";
  const ctxTitle     = searchParams.get("title");
  const ctxPrice     = searchParams.get("price");

  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const callbackUrl = `${typeof location !== "undefined" ? location.origin : ""}/auth/callback?next=${encodeURIComponent(next)}`;

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSent(true);
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 360, padding: "2rem",
        background: "var(--bg-2)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      }}>

        {ctxTitle && ctxPrice && (
          <div style={{
            background: "var(--bg-3)", borderRadius: "var(--radius-sm)",
            padding: "10px 14px", marginBottom: 20, fontSize: 13,
          }}>
            <p style={{ color: "var(--text-3)", fontSize: 11, marginBottom: 2 }}>Getting access to</p>
            <p style={{ fontWeight: 600 }}>{ctxTitle}</p>
            <p style={{ color: "var(--text-2)" }}>{ctxPrice}</p>
          </div>
        )}

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
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Continue with email</h1>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>
              Enter your email — we'll send you a link to continue.
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

        <p style={{ marginTop: 28, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
          Want to sell your content, too?{" "}
          <a href="/coming-soon" style={{ color: "var(--text-2)", textDecoration: "underline" }}>
            Learn more
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

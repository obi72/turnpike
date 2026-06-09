"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { usePasskeyWallet } from "@/hooks/usePasskeyWallet";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const WORKER_URL    = process.env.NEXT_PUBLIC_WORKER_URL!;
const BACKEND_URL   = process.env.NEXT_PUBLIC_BACKEND_URL!;

type Meta = {
  description: string;
  price: string;
  type: "url" | "file";
  fileName?: string;
  display: { price: string; provider: string; feeLabel: string };
};

type Step =
  | "loading"
  | "show"       // show content info + CTA
  | "login"      // email input
  | "otp"        // OTP input
  | "wallet"     // WebAuthn setup
  | "getting"    // fetching content
  | "done"       // URL content delivered
  | "error";

export default function PayPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string | null>(null);
  const supabase  = createBrowserClient(SUPABASE_URL, ANON_KEY);
  const { setupWallet, loading: walletBusy, error: walletErr } = usePasskeyWallet();

  const [meta, setMeta]               = useState<Meta | null>(null);
  const [step, setStep]               = useState<Step>("loading");
  const [freeEligible, setFreeEligible] = useState(false);
  const [email, setEmail]             = useState("");
  const [otp, setOtp]                 = useState("");
  const [userId, setUserId]           = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [contentUrl, setContentUrl]   = useState<string | null>(null);
  const [err, setErr]                 = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setSlug(p.slug));
  }, []);

  useEffect(() => { if (slug) init(); }, [slug]);

  async function init() {
    try {
      const res = await fetch(`${WORKER_URL}/api/meta/${slug}`);
      if (!res.ok) { setErr("Content not found."); setStep("error"); return; }
      const m: Meta = await res.json();
      setMeta(m);

      const price      = parseInt(m.price);
      const localUsed  = localStorage.getItem("trnpk_welcomed") === "1";
      const priceOk    = price <= 990_000; // ≤ $0.99

      // Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
        const { data: profile } = await supabase
          .from("users")
          .select("wallet_address, first_access_used")
          .eq("id", session.user.id)
          .single();
        if (profile?.wallet_address) setWalletAddress(profile.wallet_address);
        // Sync localStorage if DB already used
        if (profile?.first_access_used) localStorage.setItem("trnpk_welcomed", "1");
      }

      setFreeEligible(priceOk && !localUsed);
      setStep("show");
    } catch {
      setErr("Could not load content."); setStep("error");
    }
  }

  // ── Free access flow ─────────────────────────────────────────
  async function startFreeFlow() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStep("login"); return; }
    if (!walletAddress) { setStep("wallet"); return; }
    await claimFree(session.access_token);
  }

  async function handleLogin() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) { setErr(error.message); return; }
    setStep("otp");
  }

  async function handleOtp() {
    setErr(null);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    if (error || !data.session) { setErr(error?.message ?? "Verification failed."); return; }
    const u = data.session.user;
    setUserId(u.id); setUserEmail(u.email ?? null);
    // Sync user to backend
    await fetch(`${BACKEND_URL}/api/users/sync`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, email: u.email }),
    }).catch(() => {});
    // Check wallet
    const { data: profile } = await supabase.from("users").select("wallet_address").eq("id", u.id).single();
    if (profile?.wallet_address) {
      setWalletAddress(profile.wallet_address);
      await claimFree(data.session.access_token);
    } else {
      setStep("wallet");
    }
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/pay/${slug}` },
    });
  }

  async function handleWalletSetup() {
    if (!userEmail) return;
    const result = await setupWallet(userEmail);
    if (!result) return;
    await fetch(`${BACKEND_URL}/api/users/${userId}/wallet`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: result.address, credentialId: result.credentialId }),
    }).catch(() => {});
    setWalletAddress(result.address);
    const { data: { session } } = await supabase.auth.getSession();
    await claimFree(session!.access_token);
  }

  async function claimFree(accessToken: string) {
    setStep("getting"); setErr(null);
    try {
      // Get signed token from backend
      const tokenRes = await fetch(`${BACKEND_URL}/api/free-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ slug }),
      });
      if (!tokenRes.ok) {
        const e = await tokenRes.json();
        throw new Error(e.error ?? "Free access unavailable.");
      }
      const { token, userId: uid } = await tokenRes.json();

      // Fetch content from worker
      const contentRes = await fetch(`${WORKER_URL}/api/free-content/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, userId: uid }),
      });
      if (!contentRes.ok) throw new Error("Could not retrieve content.");

      // Mark device as used
      localStorage.setItem("trnpk_welcomed", "1");

      if (meta?.type === "file") {
        const blob = await contentRes.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = meta.fileName ?? "download"; a.click();
        URL.revokeObjectURL(url);
        setStep("done");
      } else {
        const { url } = await contentRes.json();
        setContentUrl(url);
        setStep("done");
      }
    } catch (e: any) {
      setErr(e.message); setStep("show");
    }
  }

  // ── Render ───────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "var(--bg-2)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 24, maxWidth: 420,
    margin: "60px auto", textAlign: "center",
  };
  const label: React.CSSProperties = {
    fontSize: 11, color: "var(--text-3)", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 6,
  };

  if (!slug || step === "loading") return (
    <div style={card}><p style={{ color: "var(--text-2)" }}>Loading…</p></div>
  );

  if (step === "error") return (
    <div style={card}>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Not found</p>
      <p style={{ fontSize: 13, color: "var(--text-2)" }}>{err}</p>
    </div>
  );

  if (step === "done") return (
    <div style={card}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Access granted</p>
      {contentUrl
        ? <a href={contentUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: "inline-block", marginTop: 8 }}>Open content →</a>
        : <p style={{ fontSize: 13, color: "var(--text-2)" }}>Your download has started.</p>
      }
    </div>
  );

  if (step === "getting") return (
    <div style={card}><p style={{ color: "var(--text-2)" }}>Unlocking content…</p></div>
  );

  if (step === "login") return (
    <div style={card}>
      <p style={{ ...label }}>Step 1 of 2</p>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Enter your email</p>
      <input
        type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        onKeyDown={e => e.key === "Enter" && handleLogin()}
        style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-1)", color: "var(--text-1)", fontSize: 14, boxSizing: "border-box", marginBottom: 10 }}
      />
      {err && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{err}</p>}
      <button className="btn-primary" style={{ width: "100%" }} onClick={handleLogin}>Send code</button>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
      <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={handleGoogleLogin}>
        Continue with Google
      </button>
    </div>
  );

  if (step === "otp") return (
    <div style={card}>
      <p style={{ ...label }}>Step 1 of 2</p>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Check your email</p>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
        Enter the 6-digit code we sent to <strong>{email}</strong>
      </p>
      <input
        type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value)}
        placeholder="123456" maxLength={6}
        onKeyDown={e => e.key === "Enter" && handleOtp()}
        style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-1)", color: "var(--text-1)", fontSize: 20, letterSpacing: "0.2em", textAlign: "center", boxSizing: "border-box", marginBottom: 10 }}
      />
      {err && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{err}</p>}
      <button className="btn-primary" style={{ width: "100%" }} onClick={handleOtp}>Verify</button>
    </div>
  );

  if (step === "wallet") return (
    <div style={card}>
      <p style={{ ...label }}>Step 2 of 2</p>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Secure your account</p>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20, lineHeight: 1.5 }}>
        Your device will ask for your PIN, Face&nbsp;ID, or Windows&nbsp;Hello once to secure future payments.
      </p>
      {walletErr && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{walletErr}</p>}
      <button className="btn-primary" style={{ width: "100%" }} onClick={handleWalletSetup} disabled={walletBusy}>
        {walletBusy ? "Opening…" : "Set up & get access"}
      </button>
    </div>
  );

  // ── Default: show content info ────────────────────────────────
  return (
    <div style={card}>
      {freeEligible && (
        <div style={{
          background: "var(--accent)", color: "#fff",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", padding: "4px 10px",
          borderRadius: 20, display: "inline-block", marginBottom: 16,
        }}>
          Free for new users
        </div>
      )}

      <p style={{ ...label }}>Content</p>
      <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
        {meta?.description}
      </p>
      {meta?.type === "file" && meta.fileName && (
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
          📎 {meta.fileName}
        </p>
      )}
      <p style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
        {freeEligible ? (
          <>
            <span style={{ textDecoration: "line-through", color: "var(--text-3)", fontSize: 16, marginRight: 8 }}>
              {meta?.display.price}
            </span>
            <span style={{ color: "var(--accent)" }}>Free</span>
          </>
        ) : meta?.display.price}
      </p>

      {err && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 12 }}>{err}</p>}

      {freeEligible ? (
        <button className="btn-primary" style={{ width: "100%" }} onClick={startFreeFlow}>
          Get free access
        </button>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>
          Paid access — coming soon.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { usePasskeyWallet } from "@/hooks/usePasskeyWallet";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const WORKER_URL    = process.env.NEXT_PUBLIC_WORKER_URL!;
const BACKEND_URL   = process.env.NEXT_PUBLIC_BACKEND_URL!;

const USDC_ON_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

type Meta = {
  description:     string;
  price:           string;
  type:            "url" | "file";
  fileName?:       string;
  splitterAddress: string;
  display: { price: string; provider: string; feeLabel: string };
};

type Step =
  | "loading"
  | "show"         // show content info + CTA
  | "login"        // email input
  | "check-email"  // magic link sent, waiting for click
  | "wallet"       // WebAuthn setup
  | "getting"     // fetching free content
  | "paying"      // signing + sending payment
  | "add-funds"   // Transak modal
  | "done"        // content delivered
  | "error";

export default function PayPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string | null>(null);
  const supabase  = createBrowserClient(SUPABASE_URL, ANON_KEY);
  const { setupWallet, signPayment, startSession, hasSession, loading: walletBusy, error: walletErr } = usePasskeyWallet();

  const [meta, setMeta]               = useState<Meta | null>(null);
  const [step, setStep]               = useState<Step>("loading");
  const [freeEligible, setFreeEligible] = useState(false);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [email, setEmail]             = useState("");
  const [userId, setUserId]           = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [contentUrl, setContentUrl]   = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [balance, setBalance]         = useState<number | null>(null);
  const [widgetUrl, setWidgetUrl]     = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
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

      const localUsed  = localStorage.getItem("trnpk_welcomed") === "1";

      // Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
        setAccessToken(session.access_token);
        const { data: profile } = await supabase
          .from("users")
          .select("wallet_address, passkey_credential_id, free_access_count")
          .eq("id", session.user.id)
          .single();
        if (profile?.wallet_address) {
          setWalletAddress(profile.wallet_address);
          setCredentialId(profile.passkey_credential_id ?? null);
          await loadBalance(profile.wallet_address);
        }
        if ((profile?.free_access_count ?? 0) >= 3) localStorage.setItem("trnpk_welcomed", "1");

        // Check if user has already paid for this slug
        const { purchased } = await fetch(
          `${BACKEND_URL}/api/purchases/check?slug=${encodeURIComponent(slug!)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        ).then(r => r.json()).catch(() => ({ purchased: false }));
        setAlreadyPurchased(purchased);
      }

      setFreeEligible(!localUsed);
      setStep("show");
    } catch {
      setErr("Could not load content."); setStep("error");
    }
  }

  async function loadBalance(addr: string) {
    try {
      const res  = await fetch(`https://api.basescan.org/api?module=account&action=tokenbalance&contractaddress=${USDC_ON_BASE}&address=${addr}&tag=latest`);
      const data = await res.json();
      const raw  = Number(data.result);
      setBalance(isNaN(raw) ? 0 : raw / 1e6);
    } catch { setBalance(0); }
  }

  // ── Paid access flow ──────────────────────────────────────────
  async function startPaidFlow() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStep("login"); return; }
    if (!walletAddress) { setStep("wallet"); return; }
    await executePaidPayment(session.access_token);
  }

  async function executePaidPayment(accessToken: string) {
    if (!meta || !walletAddress || !credentialId || !slug) return;
    setStep("paying"); setErr(null);

    const price = parseInt(meta.price);

    // Check balance
    await loadBalance(walletAddress);
    if ((balance ?? 0) < price / 1e6) {
      // Need to top up first
      try {
        const res = await fetch(`${BACKEND_URL}/api/onramp/onramp-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: JSON.stringify({ walletAddress, email: userEmail }),
        });
        if (res.ok) {
          const { url } = await res.json();
          setWidgetUrl(url);
        }
      } catch {}
      setStep("add-funds");
      return;
    }

    // Sign payment
    const paymentHeader = await signPayment({
      splitterAddress: meta.splitterAddress,
      price,
      credentialId,
    });
    if (!paymentHeader) { setStep("show"); return; }

    // Fetch content with X-Payment header
    try {
      const res = await fetch(`${WORKER_URL}/${slug}`, {
        headers: { "X-Payment": paymentHeader, "Accept": "application/json" },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Payment failed.");
        throw new Error(text);
      }

      if (meta.type === "file") {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = meta.fileName ?? "download"; a.click();
        URL.revokeObjectURL(url);
        setStep("done");
      } else {
        const { url } = await res.json();
        setContentUrl(url);
        setStep("done");
      }

      // Record purchase so user can access for free next time
      if (accessToken && slug) {
        await fetch(`${BACKEND_URL}/api/purchases`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ slug }),
        }).catch(() => {});
        setAlreadyPurchased(true);
      }
    } catch (e: any) {
      setErr(e.message); setStep("show");
    }
  }

  // ── Replay already-purchased content ─────────────────────────
  async function replayAndDeliver() {
    if (!accessToken || !slug || !meta) return;
    setStep("getting"); setErr(null);
    try {
      const { token, userId: uid } = await fetch(`${BACKEND_URL}/api/replay-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ slug }),
      }).then(r => r.json());

      const contentRes = await fetch(`${WORKER_URL}/api/free-content/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, userId: uid }),
      });
      if (!contentRes.ok) throw new Error("Could not retrieve content.");

      if (meta.type === "file") {
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

  // ── Free access flow ─────────────────────────────────────────
  async function startFreeFlow() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStep("login"); return; }
    if (!walletAddress) { setStep("wallet"); return; }
    await claimFree(session.access_token);
  }

  async function handleLogin() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/pay/${slug}`,
      },
    });
    if (error) { setErr(error.message); return; }
    setStep("check-email");
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
    if (freeEligible) {
      await claimFree(session!.access_token);
    } else {
      await executePaidPayment(session!.access_token);
    }
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

  if (step === "paying") return (
    <div style={card}><p style={{ color: "var(--text-2)" }}>Processing payment…</p></div>
  );

  if (step === "add-funds") return (
    <>
      <div style={card}>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Add funds to continue</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20, lineHeight: 1.5 }}>
          Your balance is too low to pay {meta?.display.price}. Add funds with your credit card.
        </p>
        <button className="btn-primary" style={{ width: "100%" }}
          onClick={() => widgetUrl && setStep("add-funds")}>
          + Add funds
        </button>
        <button className="btn-ghost" style={{ width: "100%", marginTop: 8 }}
          onClick={() => setStep("show")}>Cancel</button>
      </div>
      {widgetUrl && (
        <div onClick={() => { setWidgetUrl(null); setStep("show"); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg-1)", borderRadius: "var(--radius)", overflow: "hidden", width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Add Funds</span>
              <button onClick={() => { setWidgetUrl(null); setStep("show"); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-3)", lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <iframe src={widgetUrl} style={{ width: "100%", height: 620, border: "none", display: "block" }}
              allow="camera; microphone; payment" />
          </div>
        </div>
      )}
    </>
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
      <button className="btn-primary" style={{ width: "100%" }} onClick={handleLogin}>Send link</button>
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

  if (step === "check-email") return (
    <div style={card}>
      <p style={{ ...label }}>Step 1 of 2</p>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Check your inbox</p>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20, lineHeight: 1.5 }}>
        We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
      </p>
      <button className="btn-ghost" style={{ width: "100%", fontSize: 13 }}
        onClick={() => { setStep("login"); setErr(null); }}>
        ← Different email
      </button>
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

      {alreadyPurchased ? (
        <button className="btn-primary" style={{ width: "100%" }} onClick={replayAndDeliver}>
          Access content
        </button>
      ) : freeEligible ? (
        <button className="btn-primary" style={{ width: "100%" }} onClick={startFreeFlow}>
          Get free access
        </button>
      ) : (
        <button className="btn-primary" style={{ width: "100%" }} onClick={startPaidFlow}>
          {walletAddress && hasSession(walletAddress)
            ? `Pay ${meta?.display.price}`
            : `Pay ${meta?.display.price} with PIN`}
        </button>
      )}
    </div>
  );
}

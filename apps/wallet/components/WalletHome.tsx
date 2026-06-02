"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

export default function WalletHome() {
  const {
    isLoggedIn, otpSent, loading, error,
    address, login, verifyOtp, cancelOtp, logout, getUsdcBalance,
  } = useWallet();

  const [email, setEmail]     = useState("");
  const [otp, setOtp]         = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [topup, setTopup]     = useState(5);

  useEffect(() => {
    if (isLoggedIn) getUsdcBalance().then(setBalance);
  }, [isLoggedIn, address]);

  function openCoinbaseOnramp() {
    if (!address) return;
    const appId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
    const params = new URLSearchParams({
      appId:     appId ?? "",
      addresses: JSON.stringify({ [address]: ["base"] }),
      assets:    JSON.stringify(["USDC"]),
      defaultNetwork: "base",
    });
    window.open(
      `https://pay.coinbase.com/buy/select-asset?${params.toString()}`,
      "coinbase-onramp",
      "width=480,height=700",
    );
  }

  // ── Not logged in ──────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth: 360, margin: "0 auto", padding: "60px 20px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Turnpike</h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32 }}>
          Pay for digital content instantly — no app required.
        </p>

        {!otpSent ? (
          <>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>Email address</p>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e => { if (e.key === "Enter" && email) login(email); }}
              style={{ marginBottom: 12 }}
            />
            <button
              onClick={() => login(email)}
              disabled={loading || !email}
              style={{ width: "100%" }}
            >
              {loading ? "Sending code…" : "Continue with email"}
            </button>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10, textAlign: "center" }}>
              We'll send a one-time code. No password needed.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
              Code sent to <strong>{email}</strong>
            </p>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>6-digit code</p>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={otp} onChange={e => setOtp(e.target.value)}
              placeholder="123456"
              onKeyDown={e => { if (e.key === "Enter" && otp.length === 6) verifyOtp(otp); }}
              style={{ letterSpacing: "0.3em", textAlign: "center", marginBottom: 12 }}
            />
            <button
              onClick={() => verifyOtp(otp)}
              disabled={loading || otp.length < 6}
              style={{ width: "100%" }}
            >
              {loading ? "Verifying…" : "Confirm code"}
            </button>
            <button
              onClick={() => { cancelOtp(); setOtp(""); }}
              style={{ width: "100%", marginTop: 8, background: "transparent", color: "var(--text-2)", fontSize: 12 }}
            >
              ← Back
            </button>
          </>
        )}

        {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>{error}</p>}
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Turnpike</h1>
        <button
          onClick={() => logout()}
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
        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--mono)" }}>
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </p>
      </div>

      <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Add funds with card</p>
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
      <button onClick={openCoinbaseOnramp} style={{ marginBottom: 28 }}>Add ${topup}</button>

      <div style={{ background: "var(--bg-2)", borderRadius: "var(--radius)", padding: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>How payments work</p>
        {[
          "Visit any Turnpike pay link",
          "Payment is processed automatically",
          "Content unlocks in under 5 seconds",
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

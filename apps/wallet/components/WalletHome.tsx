"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

export default function WalletHome() {
  const { ready, isLoggedIn, address, login, logout, getUsdcBalance } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [topup, setTopup]     = useState(5);

  useEffect(() => {
    if (isLoggedIn) getUsdcBalance().then(setBalance);
  }, [isLoggedIn, address]);

  function openStripeOnramp() {
    if (!address) return;
    const params = new URLSearchParams({
      "transaction_details[wallet_addresses][ethereum]":         address,
      "transaction_details[lock_wallet_address]":                "true",
      "transaction_details[supported_destination_networks][]":   "base",
      "transaction_details[supported_destination_currencies][]": "usdc",
      "transaction_details[destination_currency]":               "usdc",
      "transaction_details[destination_network]":                "base",
    });
    window.open(
      `https://crypto.link.com?${params.toString()}`,
      "stripe-onramp",
      "width=480,height=700",
    );
  }

  if (!ready) return null;

  // ── Not logged in ──────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth: 360, margin: "0 auto", padding: "60px 20px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Turnpike</h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32 }}>
          Pay for digital content instantly — no app required.
        </p>
        <button onClick={login} style={{ width: "100%" }}>
          Continue with email
        </button>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10, textAlign: "center" }}>
          Enter your email and we send a code. No password needed.
        </p>
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Turnpike</h1>
        <button className="ghost" onClick={logout} style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
          Sign out
        </button>
      </div>

      {/* Balance */}
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

      {/* Add funds */}
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
      <button onClick={openStripeOnramp} style={{ marginBottom: 28 }}>Add ${topup}</button>

      {/* How it works */}
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

"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

const CDP_PROJECT_ID = process.env.NEXT_PUBLIC_CDP_PROJECT_ID ?? "";

export default function WalletHome() {
  const { address, isLoggedIn, login, logout, getUsdcBalance } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [topup, setTopup]     = useState(5);

  useEffect(() => {
    if (isLoggedIn) getUsdcBalance().then(setBalance);
  }, [isLoggedIn]);

  function openOnramp() {
    if (!address) return;
    const url =
      `https://pay.coinbase.com/buy/select-asset` +
      `?appId=${CDP_PROJECT_ID}` +
      `&addresses={"${address}":["base"]}` +
      `&assets=["USDC"]` +
      `&presetFiatAmount=${topup}`;
    window.open(url, "_blank", "width=480,height=640");
  }

  // ── Not logged in ──────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth: 360, margin: "0 auto", padding: "60px 20px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Turnpike</h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32 }}>
          Pay for digital content in seconds.
          No seed phrase needed.
        </p>
        <button onClick={() => login()}>
          Connect Wallet
        </button>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10, textAlign: "center" }}>
          Uses Coinbase Smart Wallet — create one with just your email.
        </p>
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Turnpike</h1>
        <button className="ghost" onClick={() => logout()} style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
          Sign out
        </button>
      </div>

      {/* Balance */}
      <div style={{
        background: "var(--bg-2)", borderRadius: "var(--radius)",
        padding: 24, textAlign: "center", marginBottom: 16,
      }}>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>Balance</p>
        <p style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-1px" }}>
          {balance !== null ? `$${balance.toFixed(2)}` : "…"}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--mono)" }}>
          {address?.slice(0, 6)}…{address?.slice(-4)} · Base
        </p>
      </div>

      {/* Top-up */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[2, 5, 10, 20].map(amt => (
          <button key={amt} onClick={() => setTopup(amt)} style={{
            flex: 1, padding: "8px 0", fontSize: 13,
            background: topup === amt ? "var(--accent)" : "var(--bg-2)",
            color:      topup === amt ? "#fff" : "var(--text-2)",
            border:     topup === amt ? "none" : "0.5px solid var(--border-2)",
          }}>
            ${amt}
          </button>
        ))}
      </div>
      <button onClick={openOnramp} style={{ marginBottom: 24 }}>
        Add ${topup} with card
      </button>

      {/* How it works */}
      <div style={{ background: "var(--bg-2)", borderRadius: "var(--radius)", padding: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>How payments work</p>
        {[
          "Visit any Turnpike pay link",
          "Your wallet pays automatically",
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

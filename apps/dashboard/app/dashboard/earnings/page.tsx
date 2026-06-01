"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { getMe, type PublisherProfile } from "@/lib/api";

const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "";

export default function EarningsPage() {
  const [profile, setProfile] = useState<PublisherProfile | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    getMe().then(setProfile);
  }, []);

  useEffect(() => {
    if (!profile?.provider_wallet) return;
    fetchUsdcBalance(profile.provider_wallet).then(setBalance);
  }, [profile]);

  function openTransak() {
    if (!profile) return;
    const url =
      `https://global.transak.com/?apiKey=${TRANSAK_API_KEY}` +
      `&cryptoCurrencyCode=USDC&network=base` +
      `&walletAddress=${profile.provider_wallet}` +
      `&disableWalletAddressForm=true` +
      `&isFeeCalculationShown=true` +
      `&hideMenu=true`;
    window.open(url, "_blank", "width=500,height=700");
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 560 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Earnings</h2>

        {/* Balance card */}
        <div className="card" style={{ textAlign: "center", padding: "32px 20px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>Available USDC balance</p>
          <p style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-1px" }}>
            {balance !== null ? `$${balance.toFixed(2)}` : "…"}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, fontFamily: "var(--mono)" }}>
            {profile?.provider_wallet?.slice(0, 8)}…{profile?.provider_wallet?.slice(-6)}
          </p>
        </div>

        {/* Withdraw button */}
        <button onClick={openTransak} style={{ width: "100%", marginBottom: 8 }}>
          Withdraw to bank account
        </button>
        <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>
          Via Transak · converts USDC to EUR · ~1-2 business days · ~1% fee
        </p>

        {/* Info box */}
        <div className="card" style={{ marginTop: 24, background: "var(--bg-secondary)", border: "none" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>How payouts work</h3>
          <ul style={{ listStyle: "none", fontSize: 13, color: "var(--text-2)" }}>
            {[
              "Each payment goes directly to your wallet — no waiting period.",
              "You receive 90% of each sale ($0.10+) or price minus $0.01 (for $0.05–$0.09).",
              "Withdraw anytime via Transak — minimum $10.",
              "First withdrawal requires ID verification (passport + selfie).",
            ].map((t, i) => (
              <li key={i} style={{ marginBottom: 8, paddingLeft: 16, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "var(--text-3)" }}>·</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}

async function fetchUsdcBalance(address: string): Promise<number> {
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  try {
    const res  = await fetch(
      `https://api.basescan.org/api?module=account&action=tokenbalance` +
      `&contractaddress=${USDC}&address=${address}&tag=latest`,
    );
    const data = await res.json();
    return parseFloat(data.result ?? "0") / 1e6;
  } catch {
    return 0;
  }
}

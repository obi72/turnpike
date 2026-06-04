"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const USDC_ON_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

interface Props {
  userId: string;
  walletAddress: string | null;
}

export default function WalletCard({ userId, walletAddress }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [offrampLoading, setOfframpLoading] = useState(false);
  const [offrampError, setOfframpError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) loadBalance();
  }, [walletAddress]);

  async function loadBalance() {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res  = await fetch(
        `https://api.basescan.org/api?module=account&action=tokenbalance` +
        `&contractaddress=${USDC_ON_BASE}&address=${walletAddress}&tag=latest`
      );
      const data = await res.json();
      setBalance(Number(data.result) / 1e6);
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }

  async function openOfframp() {
    if (!walletAddress || balance === null) return;
    if (balance < 10) { setOfframpError("Minimum withdrawal is $10.00"); return; }
    setOfframpLoading(true);
    setOfframpError(null);
    try {
      const { url } = await api.transakOfframpSession(walletAddress, balance);
      window.open(url, "_blank", "width=480,height=700");
    } catch (err: any) {
      setOfframpError(err.message);
    } finally {
      setOfframpLoading(false);
    }
  }

  function openOnramp() {
    if (!walletAddress) return;
    const params = new URLSearchParams({
      appId:    process.env.NEXT_PUBLIC_CDP_PROJECT_ID ?? "",
      assets:   '["USDC"]',
      addresses: JSON.stringify({ [walletAddress]: ["base"] }),
    });
    window.open(`https://pay.coinbase.com/buy/select-asset?${params}`, "_blank", "width=480,height=640");
  }

  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: 20, marginBottom: 16, textAlign: "center",
    }}>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Balance
      </p>
      <p style={{ fontSize: 42, fontWeight: 600, marginBottom: 4 }}>
        {loading ? "…" : balance !== null ? `$${balance.toFixed(2)}` : "—"}
      </p>
      {walletAddress && (
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
          {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn-primary" style={{ fontSize: 13 }} onClick={openOnramp}>
          + Add funds
        </button>
        <button
          className="btn-ghost" style={{ fontSize: 13 }}
          onClick={openOfframp}
          disabled={offrampLoading || !walletAddress || (balance ?? 0) < 10}
          title={(balance ?? 0) < 10 ? "Minimum withdrawal is $10.00" : "Withdraw to bank"}
        >
          {offrampLoading ? "…" : "Withdraw"}
        </button>
        <button className="btn-ghost" style={{ fontSize: 13 }} onClick={loadBalance} disabled={loading}>
          Refresh
        </button>
      </div>
      {offrampError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{offrampError}</p>}
    </div>
  );
}

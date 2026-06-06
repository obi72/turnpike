"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { usePasskeyWallet } from "@/hooks/usePasskeyWallet";

const USDC_ON_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

interface Props {
  userId: string;
  userEmail: string;
  walletAddress: string | null;
}

export default function WalletCard({ userId, userEmail, walletAddress }: Props) {
  const router = useRouter();
  const { setupWallet, loading: connecting, error: walletError } = usePasskeyWallet();

  const [balance, setBalance]         = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const [offrampLoading, setOfframpLoading] = useState(false);
  const [offrampError, setOfframpError]     = useState<string | null>(null);

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
    } catch { setBalance(0); }
    finally { setLoading(false); }
  }

  async function handleSetupWallet() {
    const result = await setupWallet(userEmail);
    if (!result) return;
    try {
      await api.saveWallet(userId, result.address, result.credentialId);
      router.refresh();
    } catch {}
  }

  async function openOfframp() {
    if (!walletAddress || balance === null) return;
    if (balance < 10) { setOfframpError("Minimum withdrawal is $10.00"); return; }
    setOfframpLoading(true); setOfframpError(null);
    try {
      const { url } = await api.transakOfframpSession(walletAddress, balance);
      window.open(url, "_blank", "width=480,height=700");
    } catch (err: any) { setOfframpError(err.message); }
    finally { setOfframpLoading(false); }
  }

  function openOnramp() {
    if (!walletAddress) return;
    const params = new URLSearchParams({
      appId:     process.env.NEXT_PUBLIC_CDP_PROJECT_ID ?? "",
      assets:    '["USDC"]',
      addresses: JSON.stringify({ [walletAddress]: ["base"] }),
    });
    window.open(`https://pay.coinbase.com/buy/select-asset?${params}`, "_blank", "width=480,height=640");
  }

  // ── No wallet yet ──────────────────────────────────────────────────────────
  if (!walletAddress) {
    return (
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "20px", marginBottom: 16,
        textAlign: "center",
      }}>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Set up your wallet</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.5 }}>
          Your device will ask you to create a passkey (PIN / Face&nbsp;ID / Windows&nbsp;Hello) —
          this is a one-time setup that protects your wallet.
        </p>
        <button className="btn-primary" onClick={handleSetupWallet} disabled={connecting}>
          {connecting ? "Opening…" : "Set up wallet"}
        </button>
        {walletError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{walletError}</p>}
      </div>
    );
  }

  // ── Wallet connected ───────────────────────────────────────────────────────
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
        <button onClick={loadBalance} disabled={loading}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-3)", marginLeft: 8, verticalAlign: "middle", padding: 0, lineHeight: 1 }}
          title="Refresh balance">↻</button>
      </p>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
        {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn-primary" style={{ fontSize: 13 }} onClick={openOnramp}>+ Add funds</button>
        <button className="btn-ghost" style={{ fontSize: 13 }}
          onClick={openOfframp}
          disabled={offrampLoading || (balance ?? 0) < 10}
          title={(balance ?? 0) < 10 ? "Minimum withdrawal is $10.00" : undefined}>
          {offrampLoading ? "…" : "Withdraw"}
        </button>
      </div>
      {offrampError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{offrampError}</p>}
    </div>
  );
}

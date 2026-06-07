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

function openTransak(walletAddress: string, userEmail: string, mode: "BUY" | "SELL") {
  const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "";
  const params = new URLSearchParams({
    apiKey,
    productsAvailed:        mode,
    defaultCryptoCurrency:  "USDC",
    network:                "base",
    walletAddress,
    email:                  userEmail,
    defaultFiatCurrency:    "EUR",
    themeColor:             "000000",
    environment:            "STAGING",
    redirectURL:            "https://app.trnpk.net/dashboard",
    ...(mode === "SELL" ? { defaultFiatAmount: "50" } : { defaultFiatAmount: "20" }),
  });
  const baseUrl = "https://staging-global.transak.com";
  window.open(`${baseUrl}?${params}`, "_blank", "width=500,height=700,noopener");
}

export default function WalletCard({ userId, userEmail, walletAddress }: Props) {
  const router = useRouter();
  const { setupWallet, loading: connecting, error: walletError } = usePasskeyWallet();

  const [balance, setBalance]       = useState<number | null>(null);
  const [loading, setLoading]       = useState(false);
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
      const raw = Number(data.result);
      setBalance(isNaN(raw) ? 0 : raw / 1e6);
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

  function handleWithdraw() {
    if (!walletAddress) return;
    if ((balance ?? 0) < 10) { setOfframpError("Minimum withdrawal is $10.00"); return; }
    setOfframpError(null);
    openTransak(walletAddress, userEmail, "SELL");
  }

  // ── No account yet ─────────────────────────────────────────────────────────
  if (!walletAddress) {
    return (
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "20px", marginBottom: 16,
        textAlign: "center",
      }}>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Activate your account</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.5 }}>
          Your device will ask for your PIN, Face&nbsp;ID, or Windows&nbsp;Hello once to secure your account.
        </p>
        <button className="btn-primary" onClick={handleSetupWallet} disabled={connecting}>
          {connecting ? "Opening…" : "Activate account"}
        </button>
        {walletError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{walletError}</p>}
      </div>
    );
  }

  // ── Account active ─────────────────────────────────────────────────────────
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
          title="Refresh">↻</button>
      </p>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
        {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn-primary" style={{ fontSize: 13 }}
          onClick={() => openTransak(walletAddress, userEmail, "BUY")}>
          + Add funds
        </button>
        <button className="btn-ghost" style={{ fontSize: 13 }}
          onClick={handleWithdraw}
          disabled={(balance ?? 0) < 10}
          title={(balance ?? 0) < 10 ? "Minimum withdrawal is $10.00" : undefined}>
          Withdraw
        </button>
      </div>

      {offrampError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{offrampError}</p>}
    </div>
  );
}

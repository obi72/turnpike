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
  credentialId?: string | null;
}

export default function WalletCard({ userId, userEmail, walletAddress, credentialId }: Props) {
  const router = useRouter();
  const { setupWallet, loading: connecting, error: walletError } = usePasskeyWallet();

  const [balance, setBalance]               = useState<number | null>(null);
  const [loading, setLoading]               = useState(false);
  const [onrampLoading, setOnrampLoading]   = useState(false);
  const [onrampError, setOnrampError]       = useState<string | null>(null);
  const [offrampLoading, setOfframpLoading] = useState(false);
  const [offrampError, setOfframpError]     = useState<string | null>(null);
  const [widgetUrl, setWidgetUrl]           = useState<string | null>(null);
  const [widgetTitle, setWidgetTitle]       = useState<string>("");
  useEffect(() => {
    if (walletAddress) loadBalance();
  }, [walletAddress]);

  // Reload balance when modal closes
  useEffect(() => {
    if (!widgetUrl && walletAddress) loadBalance();
  }, [widgetUrl]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = widgetUrl ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [widgetUrl]);

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

  async function handleAddFunds() {
    if (!walletAddress) return;
    setOnrampLoading(true); setOnrampError(null);
    try {
      const { url } = await api.onrampSession(walletAddress, userEmail);
      setWidgetTitle("Add Funds");
      setWidgetUrl(url);
    } catch {
      setOnrampError("Could not open payment. Please try again.");
    } finally {
      setOnrampLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!walletAddress) return;
    if ((balance ?? 0) < 10) { setOfframpError("Minimum withdrawal is $10.00"); return; }
    setOfframpLoading(true); setOfframpError(null);
    try {
      const { url } = await api.offrampSession(walletAddress, balance!, userEmail);
      setWidgetTitle("Withdraw");
      setWidgetUrl(url);
    } catch {
      setOfframpError("Could not open withdrawal. Please try again.");
    } finally {
      setOfframpLoading(false);
    }
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
    <>
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
            onClick={handleAddFunds} disabled={onrampLoading}>
            {onrampLoading ? "Opening…" : "+ Add funds"}
          </button>
          <button className="btn-ghost" style={{ fontSize: 13 }}
            onClick={handleWithdraw} disabled={offrampLoading || (balance ?? 0) < 10}
            title={(balance ?? 0) < 10 ? "Minimum withdrawal is $10.00" : undefined}>
            {offrampLoading ? "…" : "Withdraw"}
          </button>
        </div>

        {onrampError  && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{onrampError}</p>}
        {offrampError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{offrampError}</p>}
      </div>

      {/* Onramp/Offramp iFrame — full-screen overlay */}
      {widgetUrl && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
          <iframe
            src={widgetUrl}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            allow="camera; microphone; payment"
          />
          <button
            onClick={() => setWidgetUrl(null)}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(0,0,0,0.6)", color: "#fff",
              border: "none", borderRadius: "50%",
              width: 32, height: 32, fontSize: 18, lineHeight: "32px",
              cursor: "pointer", textAlign: "center", padding: 0,
            }}
            title="Close"
          >×</button>
        </div>
      )}
    </>
  );
}

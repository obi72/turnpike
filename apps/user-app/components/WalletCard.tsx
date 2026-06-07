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

  const [balance, setBalance]             = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [onrampOrder, setOnrampOrder]     = useState<{ orderId: string; clientSecret: string } | null>(null);
  const [onrampLoading, setOnrampLoading] = useState(false);
  const [onrampError, setOnrampError]     = useState<string | null>(null);
  const [offrampLoading, setOfframpLoading] = useState(false);
  const [offrampError, setOfframpError]   = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) loadBalance();
  }, [walletAddress]);

  async function loadBalance() {
    if (!walletAddress) return;
    setBalanceLoading(true);
    try {
      const res  = await fetch(
        `https://api.basescan.org/api?module=account&action=tokenbalance` +
        `&contractaddress=${USDC_ON_BASE}&address=${walletAddress}&tag=latest`
      );
      const data = await res.json();
      const raw = Number(data.result);
      setBalance(isNaN(raw) ? 0 : raw / 1e6);
    } catch { setBalance(0); }
    finally { setBalanceLoading(false); }
  }

  async function handleSetupWallet() {
    const result = await setupWallet(userEmail);
    if (!result) return;
    try {
      await api.saveWallet(userId, result.address, result.credentialId);
      router.refresh();
    } catch {}
  }

  async function openOnramp() {
    if (!walletAddress) return;
    setOnrampLoading(true); setOnrampError(null); setOnrampOrder(null);
    try {
      const { orderId, clientSecret } = await api.crossmintOrder(walletAddress, userEmail, 20);
      setOnrampOrder({ orderId, clientSecret });
    } catch (err: any) {
      setOnrampError("Could not open payment. Please try again.");
    } finally {
      setOnrampLoading(false);
    }
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
        {balanceLoading ? "…" : balance !== null ? `$${balance.toFixed(2)}` : "—"}
        <button onClick={loadBalance} disabled={balanceLoading}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-3)", marginLeft: 8, verticalAlign: "middle", padding: 0, lineHeight: 1 }}
          title="Refresh">↻</button>
      </p>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
        {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn-primary" style={{ fontSize: 13 }}
          onClick={onrampOrder ? () => setOnrampOrder(null) : openOnramp}
          disabled={onrampLoading}>
          {onrampLoading ? "Opening…" : onrampOrder ? "✕ Close" : "+ Add funds"}
        </button>
        <button className="btn-ghost" style={{ fontSize: 13 }}
          onClick={openOfframp}
          disabled={offrampLoading || (balance ?? 0) < 10}
          title={(balance ?? 0) < 10 ? "Minimum withdrawal is $10.00" : undefined}>
          {offrampLoading ? "…" : "Withdraw"}
        </button>
      </div>

      {/* Crossmint Embedded Checkout */}
      {onrampOrder && (
        <CrossmintCheckout
          orderId={onrampOrder.orderId}
          clientSecret={onrampOrder.clientSecret}
          userEmail={userEmail}
          onSuccess={() => { setOnrampOrder(null); setTimeout(loadBalance, 3000); }}
        />
      )}

      {onrampError  && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{onrampError}</p>}
      {offrampError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{offrampError}</p>}
    </div>
  );
}

// ── Crossmint Embedded Checkout ────────────────────────────────────────────
function CrossmintCheckout({
  orderId, clientSecret, userEmail, onSuccess,
}: {
  orderId: string;
  clientSecret: string;
  userEmail: string;
  onSuccess: () => void;
}) {
  const clientKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY ?? "";

  useEffect(() => {
    let Checkout: any;
    (async () => {
      try {
        const { CrossmintProvider, CrossmintEmbeddedCheckout } = await import("@crossmint/client-sdk-react-ui");
        // Dynamically rendered — handled below via dangerouslySetInnerHTML workaround
        // We render via the SDK's imperative mount if available, otherwise use component
      } catch {}
    })();
  }, []);

  return (
    <div style={{ marginTop: 16, textAlign: "left" }}>
      <CrossmintEmbeddedCheckoutWrapper
        orderId={orderId}
        clientSecret={clientSecret}
        clientKey={clientKey}
        userEmail={userEmail}
        onSuccess={onSuccess}
      />
    </div>
  );
}

function CrossmintEmbeddedCheckoutWrapper({
  orderId, clientSecret, clientKey, userEmail, onSuccess,
}: {
  orderId: string;
  clientSecret: string;
  clientKey: string;
  userEmail: string;
  onSuccess: () => void;
}) {
  const [Sdk, setSdk] = useState<any>(null);

  useEffect(() => {
    import("@crossmint/client-sdk-react-ui").then(m => setSdk(m));
  }, []);

  if (!Sdk) return <p style={{ fontSize: 13, color: "var(--text-2)", padding: 16 }}>Loading payment…</p>;

  const { CrossmintProvider, CrossmintEmbeddedCheckout } = Sdk;

  return (
    <CrossmintProvider apiKey={clientKey}>
      <CrossmintEmbeddedCheckout
        orderId={orderId}
        clientSecret={clientSecret}
        payment={{
          receiptEmail: userEmail,
          defaultMethod: "fiat",
        }}
        onEvent={(e: any) => {
          if (e.type === "payment:completed") onSuccess();
        }}
      />
    </CrossmintProvider>
  );
}

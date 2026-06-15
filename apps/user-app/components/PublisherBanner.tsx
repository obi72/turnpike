"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  walletAddress: string | null;
}

export default function PublisherBanner({ userId, walletAddress }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  const noWallet = !walletAddress;

  async function activate() {
    setLoading(true); setError(null);
    try {
      await api.activatePublisher(userId, walletAddress ?? undefined);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
      border: "1px solid rgba(37,99,235,0.5)",
      borderRadius: "var(--radius)", padding: "18px 20px", marginBottom: 16,
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
    }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Start selling</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
          {noWallet
            ? "Set up your wallet above before activating publisher mode."
            : "Add paywalls to URLs or sell file downloads. No separate registration needed."}
        </p>
        {error && <p style={{ fontSize: 12, color: "#fca5a5", marginTop: 6 }}>{error}</p>}
      </div>
      <button
        onClick={activate}
        disabled={loading || noWallet}
        style={{
          whiteSpace: "nowrap",
          background: noWallet ? "rgba(255,255,255,0.25)" : "#fff",
          color: "#1e3a8a", padding: "8px 18px",
          borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, flexShrink: 0,
          cursor: noWallet ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "…" : "Start selling"}
      </button>
    </div>
  );
}

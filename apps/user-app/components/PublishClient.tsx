"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { calcFee, MIN_PRICE_UNITS } from "@/lib/fee";
import { useRouter } from "next/navigation";
import FileUpload from "./FileUpload";
import type { User } from "@supabase/supabase-js";

interface Profile { id: string; wallet_address: string | null; }

type Tab = "url" | "file";

export default function PublishClient({ user, profile }: { user: User; profile: Profile }) {
  const [tab, setTab] = useState<Tab>("url");
  const router = useRouter();

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          className="btn-ghost"
          style={{ fontSize: 13, padding: "5px 12px" }}
          onClick={() => router.back()}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>New pay link</h1>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: "flex", gap: 2, background: "var(--bg-3)",
        borderRadius: "var(--radius-sm)", padding: 3, marginBottom: 24,
      }}>
        {(["url", "file"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px 0", fontSize: 13,
              borderRadius: "var(--radius-sm)",
              background: tab === t ? "var(--bg-2)" : "transparent",
              color: tab === t ? "var(--text)" : "var(--text-2)",
              border: tab === t ? "1px solid var(--border)" : "1px solid transparent",
            }}
          >
            {t === "url" ? "URL paywall" : "File download"}
          </button>
        ))}
      </div>

      {tab === "url" ? (
        <URLForm userId={user.id} walletAddress={profile.wallet_address} />
      ) : (
        <FileUpload userId={user.id} walletAddress={profile.wallet_address} />
      )}
    </div>
  );
}

function URLForm({ userId, walletAddress }: { userId: string; walletAddress: string | null }) {
  const [secretUrl, setSecretUrl] = useState("");
  const [price, setPrice]         = useState("0.10");
  const [description, setDesc]    = useState("");
  const [result, setResult]       = useState<any>(null);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  // Show computed fee alongside price input
  const priceNum   = parseFloat(price) || 0;
  const priceUnits = Math.round(priceNum * 1_000_000);
  const feeInfo    = calcFee(priceNum);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!walletAddress) { setError("Wallet not ready. Refresh and try again."); return; }
    if (priceUnits < MIN_PRICE_UNITS) { setError("Minimum price is $0.02"); return; }

    setLoading(true);
    try {
      const res = await api.createPayLink({
        secretUrl, price: String(priceUnits),
        description, ownerId: userId, providerWallet: walletAddress,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <p style={{ fontSize: 14, color: "var(--success)", marginBottom: 12 }}>✓ Pay link created!</p>
        <div style={{
          background: "var(--bg-3)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", padding: "10px 14px",
          fontFamily: "monospace", fontSize: 13, marginBottom: 8, wordBreak: "break-all",
        }}>
          {result.payUrl}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 20 }}>
          You receive {result.display.provider} per purchase · {result.display.feeLabel} platform fee
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn-primary" onClick={() => navigator.clipboard.writeText(result.payUrl)}>
            Copy link
          </button>
          <button className="btn-ghost" onClick={() => setResult(null)}>
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
          Secret destination URL
        </label>
        <input
          type="url" value={secretUrl} required
          placeholder="https://example.com/secret-page"
          onChange={e => setSecretUrl(e.target.value)}
        />
        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
          Users are redirected here after payment. Keep this secret.
        </p>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
          Price (USD)
        </label>
        <input
          type="number" value={price} required min="0.02" step="0.01"
          onChange={e => setPrice(e.target.value)}
        />
        {feeInfo && (
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
            You receive ${feeInfo.youGet.toFixed(4).replace(/\.?0+$/, "")} · {feeInfo.feeLabel} platform fee
          </p>
        )}
        {priceUnits > 0 && priceUnits < MIN_PRICE_UNITS && (
          <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>Minimum price is $0.02</p>
        )}
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
          Description (optional)
        </label>
        <input
          type="text" value={description}
          placeholder="Premium article, monthly report…"
          onChange={e => setDesc(e.target.value)}
        />
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

      <button type="submit" className="btn-primary" disabled={loading || priceUnits < MIN_PRICE_UNITS}>
        {loading ? "Creating…" : "Create pay link"}
      </button>
    </form>
  );
}

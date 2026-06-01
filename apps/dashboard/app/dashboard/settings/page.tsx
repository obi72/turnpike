"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { getMe, updateWallet, closeAccount, logout, type PublisherProfile } from "@/lib/api";

export default function SettingsPage() {
  const router  = useRouter();
  const [profile, setProfile]   = useState<PublisherProfile | null>(null);
  const [wallet, setWallet]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [closing, setClosing]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    getMe().then(p => { setProfile(p); setWallet(p.provider_wallet); });
  }, []);

  async function handleSaveWallet(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      await updateWallet(wallet);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!confirm("This will permanently delete your account and ALL files. Are you absolutely sure?")) return;
    if (!confirm("Second confirmation: all data will be gone forever. Continue?")) return;
    setClosing(true);
    try {
      await closeAccount();
      logout();
      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setClosing(false);
    }
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 480 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Settings</h2>

        {/* Account info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Account</h3>
          <div style={{ marginBottom: 10 }}>
            <div className="label">Email</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>{profile?.email ?? "…"}</p>
          </div>
          <div>
            <div className="label">Member since</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {profile ? new Date(profile.created_at).toLocaleDateString() : "…"}
            </p>
          </div>
        </div>

        {/* Payout wallet */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Payout wallet</h3>
          <form onSubmit={handleSaveWallet}>
            <div className="label">USDC wallet address (Base)</div>
            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="0x…"
              pattern="^0x[a-fA-F0-9]{40}$"
              style={{ marginTop: 6, marginBottom: 12 }}
              required
            />
            <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>
              Revenue from new paywalls goes to this address. Existing paywalls use their original wallet.
            </p>
            {error && <p className="error-msg" style={{ marginBottom: 10 }}>{error}</p>}
            {saved && <p className="success-msg" style={{ marginBottom: 10 }}>Saved!</p>}
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save wallet"}
            </button>
          </form>
        </div>

        {/* Fee info */}
        <div className="card" style={{ marginBottom: 16, background: "var(--bg-secondary)", border: "none" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Fee structure</h3>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span>Price $0.05 – $0.09</span><span>$0.01 flat fee</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Price $0.10 and above</span><span>10% platform fee</span>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ borderColor: "#ffcdd2" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--danger)", marginBottom: 8 }}>Danger zone</h3>
          <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
            Closing your account permanently deletes all your files and paywalls. This cannot be undone.
          </p>
          <button className="danger" onClick={handleClose} disabled={closing}>
            {closing ? "Closing…" : "Close account"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

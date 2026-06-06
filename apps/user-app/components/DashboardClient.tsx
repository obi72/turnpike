"use client";

import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import WalletCard from "./WalletCard";
import PublisherBanner from "./PublisherBanner";
import ContentList from "./ContentList";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string;
  is_publisher: boolean;
  wallet_address: string | null;
  suspended: boolean;
}

export default function DashboardClient({
  user,
  profile,
}: {
  user: User;
  profile: Profile | null;
}) {
  const supabase = createClient();
  const router   = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (profile?.suspended) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-2)", fontSize: 14 }}>
          Your account has been suspended. Contact support at hello@trnpk.net.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>{user.email}</span>
          <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      <WalletCard userId={user.id} userEmail={user.email ?? ""} walletAddress={profile?.wallet_address ?? null} />

      {!profile?.is_publisher && (
        <PublisherBanner userId={user.id} walletAddress={profile?.wallet_address ?? null} />
      )}

      {profile?.is_publisher && <ContentList ownerId={user.id} />}
    </div>
  );
}

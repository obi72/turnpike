import { createClient } from "@/lib/supabase-server";
import DashboardClient from "@/components/DashboardClient";

const BACKEND = process.env.BACKEND_URL ?? "https://api.trnpk.net";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user!.id)
    .single();

  if (!profile) {
    try {
      const res = await fetch(`${BACKEND}/api/users/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id, email: user!.email }),
        cache: "no-store",
      });
      if (res.ok) profile = await res.json();
    } catch {}
  }

  if (profile && !profile.wallet_address) {
    try {
      const res = await fetch(`${BACKEND}/api/users/${user!.id}/create-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const { walletAddress } = await res.json();
        profile = { ...profile, wallet_address: walletAddress };
      }
    } catch {}
  }

  return <DashboardClient user={user!} profile={profile} />;
}

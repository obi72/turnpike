import { createClient } from "@/lib/supabase-server";
import DashboardClient from "@/components/DashboardClient";

const BACKEND = process.env.BACKEND_URL ?? "https://turnpike-production.up.railway.app";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Sync user to backend (creates row if missing — OAuth trigger unreliable)
  let profile: any = null;
  try {
    const res = await fetch(`${BACKEND}/api/users/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user!.id, email: user!.email }),
      cache: "no-store",
    });
    if (res.ok) profile = await res.json();
  } catch {}

  // Fallback: read directly from Supabase
  if (!profile) {
    const { data } = await supabase.from("users").select("*").eq("id", user!.id).single();
    profile = data;
  }

  return <DashboardClient user={user!} profile={profile} />;
}

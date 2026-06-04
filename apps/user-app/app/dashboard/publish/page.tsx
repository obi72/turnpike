import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import PublishClient from "@/components/PublishClient";

export default async function PublishPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.is_publisher) redirect("/dashboard");
  return <PublishClient user={user} profile={profile} />;
}

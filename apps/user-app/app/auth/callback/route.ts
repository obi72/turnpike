import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "https://turnpike-production.up.railway.app";

export async function GET(request: Request) {
  const url  = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code);
    if (user) {
      await fetch(`${BACKEND}/api/users/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      }).catch(() => {});
    }
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_KEY ?? "";

if (!url || !key) {
  console.error("WARNING: SUPABASE_URL and SUPABASE_SERVICE_KEY are not set");
}

export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder", {
  auth: { autoRefreshToken: false, persistSession: false },
});

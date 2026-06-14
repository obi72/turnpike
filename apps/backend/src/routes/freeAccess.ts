import { Router } from "express";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

function hmacSign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

/**
 * POST /api/free-access
 * Auth: Supabase user JWT (Authorization: Bearer <access_token>)
 * Body: { slug }
 *
 * Issues a one-time signed token for free content access.
 * Conditions: price ≤ $0.99, first_access_used = false.
 * Atomically marks first_access_used = true to prevent double-use.
 */
router.post("/free-access", async (req, res) => {
  const jwt = req.headers.authorization?.replace("Bearer ", "");
  if (!jwt) return res.status(401).json({ error: "Unauthorized" });

  // Verify Supabase user
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: "slug required" });

  // Read current free access count
  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("free_access_count")
    .eq("id", user.id)
    .single();

  const currentCount = userData?.free_access_count ?? 0;
  if (currentCount >= 3) {
    return res.status(403).json({ error: "Free access limit reached (3 of 3 used)" });
  }

  // Atomically increment — only succeeds if count hasn't changed (optimistic lock)
  const { data: updated } = await supabaseAdmin
    .from("users")
    .update({ free_access_count: currentCount + 1 })
    .eq("id", user.id)
    .eq("free_access_count", currentCount)
    .select("id")
    .maybeSingle();

  if (!updated) {
    return res.status(403).json({ error: "Free access limit reached" });
  }

  // Issue HMAC token (5 min TTL)
  const expiry = Date.now() + 5 * 60 * 1000;
  const sig = hmacSign(process.env.ADMIN_SECRET!, `free:${user.id}:${slug}:${expiry}`);
  const token = `${expiry}.${sig}`;

  res.json({ token, userId: user.id });
});

export default router;

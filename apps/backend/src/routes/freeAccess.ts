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

  // Fetch content metadata from worker to check price
  const metaRes = await fetch(`${process.env.WORKER_URL}/api/meta/${slug}`).catch(() => null);
  if (!metaRes?.ok) return res.status(404).json({ error: "Content not found" });
  const meta = await metaRes.json();

  // Price check: ≤ $0.99 = 990_000 USDC units
  if (parseInt(meta.price) > 990_000) {
    return res.status(403).json({ error: "Price exceeds free access limit ($0.99)" });
  }

  // Atomically mark first_access_used = true (only if still false)
  const { data: updated } = await supabaseAdmin
    .from("users")
    .update({ first_access_used: true })
    .eq("id", user.id)
    .eq("first_access_used", false)
    .select("id")
    .maybeSingle();

  if (!updated) {
    return res.status(403).json({ error: "Free access already used" });
  }

  // Issue HMAC token (5 min TTL)
  const expiry = Date.now() + 5 * 60 * 1000;
  const sig = hmacSign(process.env.ADMIN_SECRET!, `free:${user.id}:${slug}:${expiry}`);
  const token = `${expiry}.${sig}`;

  res.json({ token, userId: user.id });
});

export default router;

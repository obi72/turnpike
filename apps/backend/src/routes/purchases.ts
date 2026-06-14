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

async function getUser(req: any) {
  const jwt = req.headers.authorization?.replace("Bearer ", "");
  if (!jwt) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
  return user ?? null;
}

// Record a purchase after successful payment
router.post("/purchases", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: "slug required" });

  const { error } = await supabaseAdmin
    .from("purchases")
    .upsert({ user_id: user.id, slug }, { onConflict: "user_id,slug" });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Check if user has already purchased a slug
router.get("/purchases/check", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug required" });

  const { data } = await supabaseAdmin
    .from("purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .maybeSingle();

  res.json({ purchased: !!data });
});

// Generate replay-access token for already-purchased content
// Uses same HMAC format as /api/free-access so worker accepts it
router.post("/replay-access", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: "slug required" });

  const { data } = await supabaseAdmin
    .from("purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return res.status(403).json({ error: "No purchase found for this content" });

  const expiry = Date.now() + 5 * 60 * 1000;
  const sig    = hmacSign(process.env.ADMIN_SECRET!, `free:${user.id}:${slug}:${expiry}`);
  res.json({ token: `${expiry}.${sig}`, userId: user.id });
});

export default router;

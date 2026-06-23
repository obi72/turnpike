import { Router } from "express";
import { createHmac } from "crypto";

const router = Router();

function hmacSign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

/**
 * POST /api/free-access
 * No auth required — free access is tracked per device via localStorage on the client.
 * Body: { slug, deviceId }
 *
 * Issues a short-lived HMAC token the client forwards to the worker.
 */
router.post("/free-access", async (req, res) => {
  const { slug, deviceId } = req.body;
  if (!slug || !deviceId) return res.status(400).json({ error: "slug and deviceId required" });

  const expiry = Date.now() + 5 * 60 * 1000;
  const sig    = hmacSign(process.env.ADMIN_SECRET!, `free:${deviceId}:${slug}:${expiry}`);
  const token  = `${expiry}.${sig}`;

  res.json({ token, userId: deviceId });
});

export default router;

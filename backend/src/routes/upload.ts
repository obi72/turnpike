/**
 * File upload proxy — forwards multipart form to the Cloudflare Worker.
 * Keeps ADMIN_SECRET server-side. Supports streaming progress via chunked response.
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { supabase } from "../lib/supabase";

const router  = Router();
const WORKER_URL   = process.env.WORKER_URL   ?? "https://pay.trnpk.net";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

// POST /upload — expects multipart with: file, price, description
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const ownerId = (req as any).ownerId as string;

  // Fetch publisher wallet
  const { data: publisher } = await supabase
    .from("publishers")
    .select("provider_wallet")
    .eq("id", ownerId)
    .single();

  if (!publisher) return res.status(404).json({ error: "Publisher not found" });

  // Re-stream the request body to the worker with auth headers added
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return res.status(400).json({ error: "Multipart form required" });
  }

  // Build a new FormData from the raw request
  // We re-stream the raw body and append ownerId + providerWallet
  const workerRes = await fetch(`${WORKER_URL}/api/files/upload`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${ADMIN_SECRET}`,
      "Content-Type": contentType,
    },
    // @ts-ignore — Node 18+ supports Request body as ReadableStream
    body:   req,
    duplex: "half",
  });

  const result = await workerRes.json();
  return res.status(workerRes.status).json(result);
});

export default router;

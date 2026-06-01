import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import * as worker from "../lib/worker";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// GET /publishers/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const ownerId = (req as any).ownerId as string;
  const { data, error } = await supabase
    .from("publishers")
    .select("*")
    .eq("id", ownerId)
    .single();
  if (error) return res.status(404).json({ error: "Publisher not found" });
  return res.json(data);
});

// GET /publishers/me/routes
router.get("/me/routes", requireAuth, async (req: Request, res: Response) => {
  const ownerId = (req as any).ownerId as string;
  try {
    const routes = await worker.listRoutes(ownerId);
    return res.json(routes);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /publishers/me/routes
router.post("/me/routes", requireAuth, async (req: Request, res: Response) => {
  const ownerId = (req as any).ownerId as string;
  const schema  = z.object({
    slug:          z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
    secretUrl:     z.string().url(),
    price:         z.string(),
    description:   z.string().optional(),
    providerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    const result = await worker.createRoute({ ...parsed.data, ownerId });
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /publishers/me/routes/:slug
router.delete("/me/routes/:slug", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await worker.deleteRoute(req.params.slug);
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /publishers/me/limit
router.get("/me/limit", requireAuth, async (req: Request, res: Response) => {
  const ownerId = (req as any).ownerId as string;
  try {
    const limit = await worker.getFileLimit(ownerId);
    return res.json(limit);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// PATCH /publishers/me/wallet
router.patch("/me/wallet", requireAuth, async (req: Request, res: Response) => {
  const ownerId = (req as any).ownerId as string;
  const schema  = z.object({ providerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/) });
  const parsed  = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { error } = await supabase
    .from("publishers")
    .update({ provider_wallet: parsed.data.providerWallet, updated_at: new Date().toISOString() })
    .eq("id", ownerId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// DELETE /publishers/me
router.delete("/me", requireAuth, async (req: Request, res: Response) => {
  const ownerId = (req as any).ownerId as string;
  try {
    await worker.closeAccount(ownerId);
    await supabase.from("publishers").delete().eq("id", ownerId);
    await supabase.auth.admin.deleteUser(ownerId);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;

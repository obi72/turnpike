import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { supabase } from "../lib/supabase.js";
import { createPayLink, workerFetch } from "../lib/worker.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 52_428_800 } });

const router = Router();

const CreateLinkSchema = z.object({
  secretUrl:    z.string().url(),
  price:        z.string().regex(/^\d+$/),
  description:  z.string().optional(),
  ownerId:      z.string().uuid(),
  providerWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

// File upload proxy — adds ADMIN_SECRET before forwarding to worker
router.post("/files/upload", upload.single("file"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });

  const ownerId       = req.body.ownerId        ?? "";
  const providerWallet = req.body.providerWallet ?? "";

  // Get publisher's splitter address
  const { data: userProfile } = await supabase
    .from("users")
    .select("splitter_address")
    .eq("id", ownerId)
    .single();
  const splitterAddress = userProfile?.splitter_address ?? providerWallet;

  const formData = new FormData();
  formData.append("file",            new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
  formData.append("ownerId",         ownerId);
  formData.append("price",           req.body.price          ?? "");
  formData.append("description",     req.body.description    ?? req.file.originalname);
  formData.append("providerWallet",  providerWallet);
  formData.append("splitterAddress", splitterAddress);

  const workerRes = await workerFetch("/api/files/upload", { method: "POST", body: formData as any });
  const data = await workerRes.json();
  res.status(workerRes.status).json(data);
});

router.post("/paylinks", async (req, res) => {
  const parsed = CreateLinkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { secretUrl, price, description, ownerId, providerWallet } = parsed.data;
  const priceUnits = parseInt(price);
  if (priceUnits < 50000) return res.status(400).json({ error: "Minimum price is $0.05" });

  // Get publisher's splitter address (created once at publisher activation)
  const { data: userProfile } = await supabase
    .from("users")
    .select("splitter_address")
    .eq("id", ownerId)
    .single();
  const splitterAddress = userProfile?.splitter_address ?? providerWallet;

  const slug = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

  try {
    const result = await createPayLink({ slug, secretUrl, price, description, ownerId, providerWallet, splitterAddress });

    // Save to Supabase content table
    await supabase.from("content").insert({
      owner_id: ownerId, slug, type: "url",
      price_units: priceUnits, description: description ?? slug,
      splitter_address: result.splitterAddress, secret_url: secretUrl,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/paylinks/:slug", async (req, res) => {
  const { slug } = req.params;
  const { ownerId } = req.body;

  const workerRes = await workerFetch(`/api/files/${slug}`, { method: "DELETE" });
  if (!workerRes.ok && workerRes.status !== 404) {
    return res.status(500).json({ error: "Worker delete failed" });
  }

  await supabase.from("content").delete().eq("slug", slug).eq("owner_id", ownerId);
  res.json({ ok: true });
});

router.get("/paylinks", async (req, res) => {
  const { ownerId } = req.query as { ownerId: string };
  if (!ownerId) return res.status(400).json({ error: "ownerId required" });

  const workerRes = await workerFetch(`/api/routes?ownerId=${ownerId}`);
  if (!workerRes.ok) return res.status(500).json({ error: "Worker error" });
  res.json(await workerRes.json());
});

export default router;

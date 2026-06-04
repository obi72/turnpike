import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { createUserWallet } from "../lib/cdp.js";

const router = Router();

// Called by user-app after Supabase auth to ensure user row + wallet exist
router.post("/users/sync", async (req, res) => {
  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: "userId and email required" });

  const { data, error } = await supabase
    .from("users")
    .upsert({ id: userId, email, last_active_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Activate publisher role for a user
router.post("/users/:id/activate-publisher", async (req, res) => {
  const { id } = req.params;
  const { walletAddress } = req.body;

  const updates: Record<string, unknown> = { is_publisher: true };
  if (walletAddress) updates.wallet_address = walletAddress;

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create CDP wallet and store address
router.post("/users/:id/create-wallet", async (req, res) => {
  const { id } = req.params;

  const { data: existing } = await supabase
    .from("users")
    .select("wallet_address")
    .eq("id", id)
    .single();

  if (existing?.wallet_address) {
    return res.json({ walletAddress: existing.wallet_address });
  }

  let walletAddress: string;
  try {
    walletAddress = await createUserWallet();
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }

  const { data, error } = await supabase
    .from("users")
    .update({ wallet_address: walletAddress })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ walletAddress: data.wallet_address });
});

// Store wallet address (called after CDP wallet creation)
router.post("/users/:id/wallet", async (req, res) => {
  const { id } = req.params;
  const { walletAddress } = req.body;

  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  const { data, error } = await supabase
    .from("users")
    .update({ wallet_address: walletAddress })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { createSplitterWallet } from "../lib/cdp.js";

const router = Router();

/**
 * Sync user after login.
 * Supports two modes:
 *   - userId + email  → Supabase-auth user (Google OAuth, existing)
 *   - email only      → cdp-hooks email-OTP user: find or create Supabase auth user
 * Optional: walletAddress to save in the same call.
 */
router.post("/users/sync", async (req, res) => {
  const { userId, email, walletAddress } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });

  let finalUserId = userId as string | undefined;

  if (!finalUserId) {
    // Look up existing user by email in public.users
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      finalUserId = existing.id;
    } else {
      // Create a confirmed Supabase auth user (no password — auth is handled by cdp-hooks)
      const { data: authData, error: authError } = await (supabase.auth as any).admin.createUser({
        email,
        email_confirm: true,
      });
      if (authError) return res.status(500).json({ error: authError.message });
      finalUserId = authData.user!.id;
    }
  }

  const updates: Record<string, unknown> = {
    id: finalUserId,
    email,
    last_active_at: new Date().toISOString(),
  };
  if (walletAddress) updates.wallet_address = walletAddress;

  const { data, error } = await supabase
    .from("users")
    .upsert(updates, { onConflict: "id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Activate publisher role for a user — creates CDP splitter wallet (once)
router.post("/users/:id/activate-publisher", async (req, res) => {
  const { id } = req.params;
  const { walletAddress } = req.body;

  const { data: existing } = await supabase
    .from("users")
    .select("splitter_address")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = { is_publisher: true };
  if (walletAddress) updates.wallet_address = walletAddress;

  if (!existing?.splitter_address && walletAddress) {
    try {
      const splitterAddress = await createSplitterWallet(
        walletAddress,
        process.env.PLATFORM_WALLET!,
      );
      updates.splitter_address = splitterAddress;
    } catch (err: any) {
      console.error("Splitter wallet creation failed, using provider wallet:", err.message);
      updates.splitter_address = walletAddress;
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Store wallet address (and optional passkey credential ID)
router.post("/users/:id/wallet", async (req, res) => {
  const { id } = req.params;
  const { walletAddress, credentialId } = req.body;

  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  const updates: Record<string, string> = { wallet_address: walletAddress };
  if (credentialId) updates.passkey_credential_id = credentialId;

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;

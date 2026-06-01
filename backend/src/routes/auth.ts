import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";

const signupSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(8),
  providerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

// POST /auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, providerWallet } = parsed.data;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { providerWallet },
  });

  if (error) return res.status(400).json({ error: error.message });

  const ownerId = data.user.id;

  await supabase.from("publishers").insert({
    id:              ownerId,
    email,
    provider_wallet: providerWallet,
  });

  const token = jwt.sign({ sub: ownerId, email }, JWT_SECRET, { expiresIn: "30d" });
  return res.json({ token, ownerId, email });
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: "Invalid credentials" });

  const ownerId = data.user.id;
  const token   = jwt.sign({ sub: ownerId, email }, JWT_SECRET, { expiresIn: "30d" });
  return res.json({ token, ownerId, email });
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (!auth) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(auth, JWT_SECRET) as { sub: string; email: string };
    const token   = jwt.sign({ sub: payload.sub, email: payload.email }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

export default router;

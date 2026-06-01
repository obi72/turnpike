import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRouter       from "./routes/auth";
import publishersRouter from "./routes/publishers";
import uploadRouter     from "./routes/upload";

const app  = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({
  origin: [
    "https://trnpk.net",
    "https://wallet.trnpk.net",
    "https://app.trnpk.net",
    "https://admin.trnpk.net",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ],
  credentials: true,
}));

// CDP API proxy — bypasses browser CORS restrictions
app.all("/cdp-proxy/*", async (req, res) => {
  const cdpPath = req.path.replace("/cdp-proxy", "");
  const cdpUrl  = `https://api.cdp.coinbase.com${cdpPath}`;
  try {
    const upstream = await fetch(cdpUrl, {
      method:  req.method,
      headers: {
        "Content-Type": "application/json",
        ...(req.headers["authorization"] ? { Authorization: req.headers["authorization"] as string } : {}),
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const data = await upstream.text();
    res.status(upstream.status).set("Content-Type", "application/json").send(data);
  } catch (e: any) {
    res.status(502).json({ error: "CDP proxy error", detail: e.message });
  }
});
app.use(express.json({ limit: "1mb" }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
}));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth",       authRouter);
app.use("/publishers", publishersRouter);
app.use("/upload",     uploadRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`Turnpike backend on :${PORT}`);
  console.log(`SUPABASE_URL set: ${!!process.env.SUPABASE_URL}`);
  console.log(`SUPABASE_SERVICE_KEY set: ${!!process.env.SUPABASE_SERVICE_KEY}`);
  console.log(`JWT_SECRET set: ${!!process.env.JWT_SECRET}`);
});

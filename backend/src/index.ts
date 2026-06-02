import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
// @ts-ignore
import { generateJwt } from "@coinbase/cdp-sdk/auth";

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

app.use(express.json({ limit: "1mb" }));

// CDP API proxy — bypasses browser CORS restrictions
// app.use("/cdp-proxy") makes req.path relative to /cdp-proxy
app.use("/cdp-proxy", async (req: express.Request, res: express.Response) => {
  const requestPath = req.path;
  const cdpUrl      = `https://api.cdp.coinbase.com${requestPath}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;
  try {
    // Generate a fresh JWT for each CDP API request
    const jwt = await generateJwt({
      apiKeyId:      process.env.CDP_API_KEY_ID     ?? "",
      apiKeySecret:  process.env.CDP_API_KEY_SECRET  ?? "",
      requestMethod: req.method,
      requestHost:   "api.cdp.coinbase.com",
      requestPath,
    });

    const upstream = await fetch(cdpUrl, {
      method:  req.method,
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${jwt}`,
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const data = await upstream.text();
    res.status(upstream.status).set("Content-Type", "application/json").send(data);
  } catch (e: any) {
    res.status(502).json({ error: "CDP proxy error", detail: e.message });
  }
});

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

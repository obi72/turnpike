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
    "https://app.trnpk.net",
    "https://admin.trnpk.net",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ],
  credentials: true,
}));
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

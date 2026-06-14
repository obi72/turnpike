import express from "express";
import cors from "cors";
import paylinksRouter from "./routes/paylinks.js";
import stripeRouter    from "./routes/stripe.js";
import transakRouter   from "./routes/transak.js";
import onrampRouter    from "./routes/onramp.js";
import usersRouter     from "./routes/users.js";
import crossmintRouter from "./routes/crossmint.js";
import splitRouter      from "./routes/split.js";
import freeAccessRouter from "./routes/freeAccess.js";
import purchasesRouter  from "./routes/purchases.js";

const app  = express();
const port = parseInt(process.env.PORT ?? "3001");

app.use(cors({
  origin: [
    "https://app.trnpk.net",
    "http://localhost:3000",
  ],
}));
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));

app.use("/api", paylinksRouter);
app.use("/api", stripeRouter);
app.use("/api", transakRouter);
app.use("/api", onrampRouter);
app.use("/api", usersRouter);
app.use("/api", crossmintRouter);
app.use("/api", splitRouter);
app.use("/api", freeAccessRouter);
app.use("/api", purchasesRouter);

app.listen(port, () => console.log(`Backend running on :${port}`));

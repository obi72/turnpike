import express from "express";
import cors from "cors";
import paylinksRouter from "./routes/paylinks.js";
import stripeRouter   from "./routes/stripe.js";
import transakRouter  from "./routes/transak.js";
import usersRouter    from "./routes/users.js";

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
app.use("/api", usersRouter);

app.listen(port, () => console.log(`Backend running on :${port}`));

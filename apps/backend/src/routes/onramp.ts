import { Router } from "express";
import transakRouter  from "./transak.js";
import mercuryoRouter from "./mercuryo.js";

// Switch provider via ONRAMP_PROVIDER env var.
// Default: transak. Set to "mercuryo" to use Mercuryo.
// Rollback: set ONRAMP_PROVIDER=transak in Railway.

const router = Router();
const provider = (process.env.ONRAMP_PROVIDER ?? "transak").toLowerCase();

if (provider === "mercuryo") {
  router.post("/onramp/onramp-session",  (req, res, next) => {
    req.url = "/mercuryo/onramp-session";
    mercuryoRouter(req, res, next);
  });
  router.post("/onramp/offramp-session", (req, res, next) => {
    req.url = "/mercuryo/offramp-session";
    mercuryoRouter(req, res, next);
  });
} else {
  router.post("/onramp/onramp-session",  (req, res, next) => {
    req.url = "/transak/onramp-session";
    transakRouter(req, res, next);
  });
  router.post("/onramp/offramp-session", (req, res, next) => {
    req.url = "/transak/offramp-session";
    transakRouter(req, res, next);
  });
}

export default router;

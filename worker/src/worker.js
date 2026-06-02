/**
 * Turnpike — Main Paywall Worker
 * Handles x402 payment gates for URL redirects and file downloads.
 * Revenue split via Coinbase CDP splitter wallets.
 * File storage via Cloudflare R2.
 *
 * Bindings required (wrangler.toml):
 *   KV:      ROUTES
 *   R2:      FILES
 *   Vars:    FACILITATOR_URL, PLATFORM_WALLET, PLATFORM_SPLIT
 *   Secrets: CDP_API_KEY, ADMIN_SECRET
 *
 * Cron: "0 3 * * *" — daily cleanup
 */

import { calculateFee } from "./fee.js";

// USDC-Adresse auf Base Mainnet
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const CDP_BASE            = "https://api.cdp.coinbase.com/platform/v1";
const MAX_FILE_SIZE       = 50 * 1024 * 1024;  // 50 MB
const MAX_FILES_PER_OWNER = 25;
const DOWNLOAD_TTL_DAYS   = 30;
const INACTIVITY_DAYS     = 60;
const PAY_BASE            = "https://pay.trnpk.net";

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    let response;
    if (path === "/api/routes"         && request.method === "POST")   response = await handleCreateRoute(request, env);
    else if (path === "/api/routes"    && request.method === "GET")    response = await handleListRoutes(request, env);
    else if (path === "/api/files/upload" && request.method === "POST") response = await handleUpload(request, env);
    else if (path === "/api/files/limit"  && request.method === "GET")  response = await handleLimitCheck(request, env);
    else if (path.startsWith("/api/files/") && request.method === "GET")    response = await handleFileMeta(request, env);
    else if (path.startsWith("/api/files/") && request.method === "DELETE") response = await handleDeleteFile(request, env);
    else if (path === "/api/account/close" && request.method === "DELETE")  response = await handleCloseAccount(request, env);
    else response = await handlePaywall(request, env);

    // Attach CORS headers to all responses
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },

  async scheduled(event, env) {
    await runCleanup(env);
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

// ── Paywall — x402-Implementierung ────────────────────────────
// Protokoll:
//   1. Request ohne X-PAYMENT → 402 + Zahlungsanforderungen
//   2. Request mit X-PAYMENT  → Facilitator verifiziert + settled
//   3. Bei Erfolg             → Datei oder Redirect
async function handlePaywall(request, env) {
  const slug = new URL(request.url).pathname.replace(/^\//, "");
  if (!slug) return new Response("Not found", { status: 404 });

  const raw = await env.ROUTES.get(slug);
  if (!raw) return new Response("Not found", { status: 404 });

  const route = JSON.parse(raw);

  if (route.suspended) {
    return new Response("This content is currently unavailable.", { status: 403 });
  }

  const facilitatorUrl = env.FACILITATOR_URL ?? "https://facilitator.cdp.coinbase.com";
  const resourceUrl    = `${PAY_BASE}/${slug}`;

  // Zahlungsanforderungen (werden im 402 und bei der Verifizierung gebraucht)
  const paymentPayload = {
    scheme:             "exact",
    network:            "base",
    maxAmountRequired:  route.price.toString(),
    resource:           resourceUrl,
    description:        route.description ?? slug,
    mimeType:           route.type === "file" ? "application/octet-stream" : "text/html",
    payTo:              route.splitterAddress,
    maxTimeoutSeconds:  300,
    asset:              USDC_ADDRESS,
    extra: { name: "USDC", version: "2" },
  };

  const paymentHeader = request.headers.get("X-PAYMENT");

  // ── Kein Payment-Header: 402 zurückgeben ──────────────────
  if (!paymentHeader) {
    return new Response(
      JSON.stringify({
        x402Version: 1,
        accepts:     [paymentPayload],
        error:       null,
      }),
      {
        status:  402,
        headers: {
          "Content-Type":    "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // ── Payment-Header vorhanden: verifizieren ────────────────
  try {
    const verifyRes = await fetch(`${facilitatorUrl}/verify`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ payment: paymentHeader, payload: paymentPayload }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.text();
      return new Response(JSON.stringify({ error: "Payment verification failed", detail: err }),
        { status: 402, headers: { "Content-Type": "application/json" } });
    }

    // ── Zahlung gültig: Transaktion finalisieren ──────────
    await fetch(`${facilitatorUrl}/settle`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ payment: paymentHeader, payload: paymentPayload }),
    });

    // Aktivität aktualisieren
    await updateOwnerActivity(route.ownerId, env);

    // ── Inhalt ausliefern ─────────────────────────────────
    if (route.type === "file") {
      const object = await env.FILES.get(route.r2Key);
      if (!object) return new Response("File not found", { status: 404 });

      route.lastDownload = Date.now();
      await env.ROUTES.put(slug, JSON.stringify(route));

      return new Response(object.body, {
        headers: {
          "Content-Type":        object.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${route.fileName}"`,
          "Content-Length":      route.fileSize.toString(),
        },
      });
    }

    // URL-Paywall: Redirect zur geheimen URL
    return Response.redirect(route.secretUrl, 302);

  } catch (e) {
    return new Response(JSON.stringify({ error: "Paywall error", detail: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

// ── Create URL route ───────────────────────────────────────────
async function handleCreateRoute(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });

  const { slug, secretUrl, price, description, ownerId, providerWallet } = await request.json();

  if (!slug || !secretUrl || !price || !providerWallet) {
    return Response.json({ error: "slug, secretUrl, price, providerWallet required" }, { status: 400 });
  }

  let fee;
  try { fee = calculateFee(parseInt(price)); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }

  const splitterAddress = await createSplitterWallet({
    providerWallet,
    priceUnits:  parseInt(price),
    platformFee: fee.platformFee,
    env,
  });

  const route = {
    type: "url", secretUrl, price, description: description ?? slug,
    ownerId, providerWallet, splitterAddress,
    feeModel: fee.model, platformFee: fee.platformFee,
    createdAt: Date.now(),
  };

  await env.ROUTES.put(slug, JSON.stringify(route));
  await updateOwnerIndex(ownerId, slug, env);
  await updateOwnerActivity(ownerId, env);

  return Response.json({
    ok: true,
    payUrl: `${PAY_BASE}/${slug}`,
    splitterAddress,
    display: fee.display,
  });
}

// ── Upload file ────────────────────────────────────────────────
async function handleUpload(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });

  const formData    = await request.formData();
  const file        = formData.get("file");
  const ownerId     = formData.get("ownerId");
  const price       = formData.get("price");
  const description = formData.get("description") ?? file?.name;
  const providerWallet = formData.get("providerWallet");

  if (!file || !ownerId || !price) {
    return Response.json({ error: "file, ownerId, price required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum: 50 MB`,
    }, { status: 413 });
  }

  const limit = await getFileLimit(ownerId, env);
  if (!limit.allowed) {
    return Response.json({
      error: "FILE_LIMIT_REACHED",
      count: limit.count,
      max: MAX_FILES_PER_OWNER,
      upgradeEmail: "hello@trnpk.net",
    }, { status: 429 });
  }

  let fee;
  try { fee = calculateFee(parseInt(price)); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }

  const fileId = crypto.randomUUID();
  const ext    = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const r2Key  = `files/${ownerId}/${fileId}.${ext}`;

  await env.FILES.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType:        file.type || "application/octet-stream",
      contentDisposition: `attachment; filename="${file.name}"`,
    },
    customMetadata: {
      ownerId,
      originalName: file.name,
      uploadedAt:   Date.now().toString(),
      lastDownload: Date.now().toString(),
      price,
      description,
      fileSize: file.size.toString(),
    },
  });

  const slug            = slugify(file.name);
  const splitterAddress = await createSplitterWallet({
    providerWallet,
    priceUnits:  parseInt(price),
    platformFee: fee.platformFee,
    env,
  });

  const route = {
    type: "file", r2Key, fileName: file.name, fileSize: file.size,
    price, description, ownerId, splitterAddress,
    feeModel: fee.model, platformFee: fee.platformFee,
    createdAt: Date.now(), lastDownload: Date.now(),
  };

  await env.ROUTES.put(slug, JSON.stringify(route));
  await updateOwnerIndex(ownerId, slug, env);
  await updateOwnerActivity(ownerId, env);

  return Response.json({
    ok: true,
    payUrl:   `${PAY_BASE}/${slug}`,
    fileId,
    fileName: file.name,
    display:  fee.display,
  });
}

// ── File limit check ───────────────────────────────────────────
async function handleLimitCheck(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });
  const ownerId = new URL(request.url).searchParams.get("ownerId");
  if (!ownerId) return Response.json({ error: "ownerId required" }, { status: 400 });
  return Response.json(await getFileLimit(ownerId, env));
}

async function getFileLimit(ownerId, env) {
  const slotLimitRaw = await env.ROUTES.get(`slots:${ownerId}`);
  const slotLimit    = slotLimitRaw ? parseInt(slotLimitRaw) : MAX_FILES_PER_OWNER;
  const indexRaw     = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs        = indexRaw ? JSON.parse(indexRaw) : [];
  let count = 0;
  for (const slug of slugs) {
    const raw = await env.ROUTES.get(slug);
    if (raw && JSON.parse(raw).type === "file") count++;
  }
  return { allowed: count < slotLimit, count, max: slotLimit, remaining: slotLimit - count };
}

// ── List routes ────────────────────────────────────────────────
async function handleListRoutes(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });
  const ownerId  = new URL(request.url).searchParams.get("ownerId");
  if (!ownerId) return Response.json({ error: "ownerId required" }, { status: 400 });
  const indexRaw = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
  const routes   = await Promise.all(slugs.map(async slug => {
    const raw = await env.ROUTES.get(slug);
    if (!raw) return null;
    const r   = JSON.parse(raw);
    const fee = calculateFee(parseInt(r.price));
    const daysUntilDelete = r.type === "file"
      ? Math.max(0, DOWNLOAD_TTL_DAYS - Math.floor((Date.now() - r.lastDownload) / 86400000))
      : null;
    return {
      slug, type: r.type, description: r.description, fileName: r.fileName,
      fileSize: r.fileSize, price: fee.display.price,
      providerGets: fee.display.provider, feeLabel: fee.display.feeLabel,
      createdAt: r.createdAt, daysUntilDelete,
      payUrl: `${PAY_BASE}/${slug}`,
    };
  }));
  return Response.json(routes.filter(Boolean));
}

// ── File meta / delete ─────────────────────────────────────────
async function handleFileMeta(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });
  const slug  = new URL(request.url).pathname.replace("/api/files/", "");
  const raw   = await env.ROUTES.get(slug);
  if (!raw) return new Response("Not found", { status: 404 });
  const route = JSON.parse(raw);
  const daysUntilDelete = Math.max(
    0,
    DOWNLOAD_TTL_DAYS - Math.floor((Date.now() - route.lastDownload) / 86400000),
  );
  return Response.json({
    slug, fileName: route.fileName, fileSize: route.fileSize,
    price: route.price, payUrl: `${PAY_BASE}/${slug}`, daysUntilDelete,
  });
}

async function handleDeleteFile(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });
  const slug  = new URL(request.url).pathname.replace("/api/files/", "");
  const raw   = await env.ROUTES.get(slug);
  if (!raw) return new Response("Not found", { status: 404 });
  await deleteFile(slug, JSON.parse(raw), env);
  return Response.json({ ok: true });
}

async function handleCloseAccount(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });
  const { ownerId } = await request.json();
  const deleted = await deleteAllOwnerFiles(ownerId, env);
  await env.ROUTES.delete(`owner:${ownerId}`);
  await env.ROUTES.delete(`activity:${ownerId}`);
  await env.ROUTES.delete(`slots:${ownerId}`);
  return Response.json({ ok: true, deleted });
}

// ── Splitter wallet ────────────────────────────────────────────
// Versucht eine CDP-Splitter-Wallet anzulegen (automatische 90/10 Aufteilung).
// Falls CDP nicht konfiguriert ist, wird direkt an die Provider-Wallet gezahlt.
async function createSplitterWallet({ providerWallet, priceUnits, platformFee, env }) {
  if (!env.CDP_API_KEY || !env.CDP_API_KEY_PRIVATE) {
    console.warn("CDP_API_KEY not configured — payments go directly to provider wallet");
    return providerWallet;
  }

  try {
    const providerPct = Math.round(((priceUnits - platformFee) / priceUnits) * 100);
    const platformPct = 100 - providerPct;

    const jwt = await buildCdpJwt(env.CDP_API_KEY, env.CDP_API_KEY_PRIVATE, "POST", "/platform/v1/wallets");

    const walletRes = await fetch(`${CDP_BASE}/wallets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ network_id: "base-mainnet" }),
    });

    if (!walletRes.ok) {
      console.warn("CDP wallet creation failed, falling back to provider wallet");
      return providerWallet;
    }

    const wallet          = await walletRes.json();
    const splitterAddress = wallet.default_address.address_id;

    const ruleRes = await fetch(`${CDP_BASE}/wallets/${wallet.id}/webhook_rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        event_type: "erc20_transfer", asset: "usdc", trigger: "on_receive",
        actions: [
          { type: "transfer", to: providerWallet,      percentage: providerPct, asset: "usdc", network_id: "base-mainnet" },
          { type: "transfer", to: env.PLATFORM_WALLET, percentage: platformPct, asset: "usdc", network_id: "base-mainnet" },
        ],
      }),
    });

    if (!ruleRes.ok) {
      console.warn("CDP webhook rule failed, falling back to provider wallet");
      return providerWallet;
    }

    return splitterAddress;
  } catch (e) {
    console.warn("CDP error:", e.message, "— falling back to provider wallet");
    return providerWallet;
  }
}

// Baut ein kurzlebiges request-spezifisches JWT für die CDP API (ES256 / P-256).
// Das "uris"-Claim ist erforderlich: "METHOD host/path"
async function buildCdpJwt(keyId, privateKeyB64, method = "POST", path = "/platform/v1/wallets") {
  const raw    = Uint8Array.from(atob(privateKeyB64), c => c.charCodeAt(0));
  const key    = await crypto.subtle.importKey(
    "pkcs8", raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"],
  );
  const now    = Math.floor(Date.now() / 1000);
  const header  = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    sub:  keyId,
    iss:  "cdp",
    nbf:  now,
    exp:  now + 120,
    uris: `${method} api.cdp.coinbase.com${path}`,
  };
  const enc     = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const data    = `${enc(header)}.${enc(payload)}`;
  const sig     = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data));
  const sigB64  = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${sigB64}`;
}

// ── Daily cleanup ──────────────────────────────────────────────
async function runCleanup(env) {
  const now = Date.now();
  const { keys } = await env.ROUTES.list({ prefix: "owner:" });
  let totalDeleted = 0;

  for (const { name } of keys) {
    const ownerId     = name.replace("owner:", "");
    const activityRaw = await env.ROUTES.get(`activity:${ownerId}`);
    const inactiveDays = activityRaw ? (now - parseInt(activityRaw)) / 86400000 : 999;

    if (inactiveDays >= INACTIVITY_DAYS) {
      totalDeleted += await deleteAllOwnerFiles(ownerId, env);
      continue;
    }

    const indexRaw = await env.ROUTES.get(name);
    const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
    for (const slug of slugs) {
      const raw = await env.ROUTES.get(slug);
      if (!raw) continue;
      const route = JSON.parse(raw);
      if (route.type !== "file") continue;
      const daysSinceDownload = (now - route.lastDownload) / 86400000;
      if (daysSinceDownload >= DOWNLOAD_TTL_DAYS) {
        await deleteFile(slug, route, env);
        totalDeleted++;
      }
    }
  }
  console.log(`Cleanup: ${totalDeleted} files deleted`);
}

// ── Helpers ────────────────────────────────────────────────────
async function deleteFile(slug, route, env) {
  if (route.r2Key) await env.FILES.delete(route.r2Key);
  await env.ROUTES.delete(slug);
  const indexKey = `owner:${route.ownerId}`;
  const indexRaw = await env.ROUTES.get(indexKey);
  if (indexRaw) {
    await env.ROUTES.put(indexKey, JSON.stringify(JSON.parse(indexRaw).filter(s => s !== slug)));
  }
}

async function deleteAllOwnerFiles(ownerId, env) {
  const indexRaw = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
  let deleted    = 0;
  for (const slug of slugs) {
    const raw = await env.ROUTES.get(slug);
    if (!raw) continue;
    const route = JSON.parse(raw);
    if (route.type === "file") { await deleteFile(slug, route, env); deleted++; }
  }
  return deleted;
}

async function updateOwnerIndex(ownerId, slug, env) {
  const key      = `owner:${ownerId}`;
  const existing = await env.ROUTES.get(key);
  const index    = existing ? JSON.parse(existing) : [];
  if (!index.includes(slug)) index.push(slug);
  await env.ROUTES.put(key, JSON.stringify(index));
}

async function updateOwnerActivity(ownerId, env) {
  await env.ROUTES.put(`activity:${ownerId}`, Date.now().toString());
}

function slugify(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

function checkAuth(request, env) {
  return request.headers.get("Authorization") === `Bearer ${env.ADMIN_SECRET}`;
}


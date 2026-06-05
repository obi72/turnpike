/**
 * Turnpike — Main Paywall Worker
 * pay.trnpk.net
 *
 * wrangler.toml bindings:
 *   KV:      ROUTES
 *   R2:      FILES
 *   Vars:    FACILITATOR_URL, PLATFORM_WALLET
 *   Secrets: CDP_API_KEY, ADMIN_SECRET
 */

import { calculateFee } from "./fee.js";

// USDC contract address on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const CDP_BASE          = "https://api.cdp.coinbase.com/platform/v1";
const MAX_FILE_SIZE     = 50 * 1024 * 1024;  // 50 MB
const DOWNLOAD_TTL_DAYS = 30;
const INACTIVITY_DAYS   = 60;

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/routes"         && request.method === "POST")   return handleCreateRoute(request, env);
    if (path === "/api/routes"         && request.method === "GET")    return handleListRoutes(request, env);
    if (path === "/api/files/upload"   && request.method === "POST")   return handleUpload(request, env);
    if (path === "/api/files/limit"    && request.method === "GET")    return handleLimitCheck(request, env);
    if (path.startsWith("/api/files/") && request.method === "GET")    return handleFileMeta(request, env);
    if (path.startsWith("/api/files/") && request.method === "DELETE") return handleDeleteFile(request, env);
    if (path === "/api/account/close"  && request.method === "DELETE") return handleCloseAccount(request, env);
    if (path === "/health"             && request.method === "GET")    return Response.json({ ok: true });

    return handlePaywall(request, env);
  },

  async scheduled(event, env) {
    await runCleanup(env);
  },
};

// ── Paywall — x402 protocol implementation ────────────────────
async function handlePaywall(request, env) {
  const slug = new URL(request.url).pathname.replace(/^\//, "");
  if (!slug) return new Response("Not found", { status: 404 });

  const raw = await env.ROUTES.get(slug);
  if (!raw) return new Response("Not found", { status: 404 });

  const route = JSON.parse(raw);

  if (route.suspended) {
    return new Response("This content is currently unavailable.", { status: 403 });
  }

  // Payment requirements for x402
  const paymentRequirements = {
    scheme:             "exact",
    network:            "base-mainnet",
    maxAmountRequired:  String(route.price),
    resource:           request.url,
    description:        route.description,
    mimeType:           route.type === "file" ? "application/octet-stream" : "text/html",
    payTo:              route.splitterAddress,
    maxTimeoutSeconds:  300,
    asset:              USDC_ADDRESS,
    extra:              { name: "USDC", version: "2" },
  };

  // Step 1: No payment yet → return 402
  const paymentHeader = request.headers.get("X-Payment");
  if (!paymentHeader) {
    return new Response("Payment Required", {
      status: 402,
      headers: {
        "X-Payment-Required": JSON.stringify(paymentRequirements),
        "Content-Type":       "application/json",
        "Access-Control-Expose-Headers": "X-Payment-Required",
      },
    });
  }

  // Step 2: Verify payment via Coinbase Facilitator
  const verifyRes = await fetch(`${env.FACILITATOR_URL}/verify`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ payment: paymentHeader, paymentRequirements }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.text().catch(() => "Verification failed");
    return new Response(JSON.stringify({ error: err }), {
      status:  402,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Step 3: Payment verified → deliver content
  await updateOwnerActivity(route.ownerId, env);

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

  return Response.redirect(route.secretUrl, 302);
}

// ── Create URL pay link ────────────────────────────────────────
async function handleCreateRoute(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });

  const body = await request.json();
  const { slug, secretUrl, price, description, ownerId, providerWallet } = body;
  const splitterAddress = body.splitterAddress ?? providerWallet;

  if (!slug || !secretUrl || !price || !providerWallet || !ownerId) {
    return Response.json({ error: "slug, secretUrl, price, ownerId, providerWallet required" }, { status: 400 });
  }

  const existing = await env.ROUTES.get(slug);
  if (existing) return Response.json({ error: "Slug already taken" }, { status: 409 });

  let fee;
  try { fee = calculateFee(parseInt(price)); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }

  const route = {
    type: "url", secretUrl, price, description: description ?? slug,
    ownerId, providerWallet, splitterAddress,
    feeModel: fee.model, platformFee: fee.platformFee,
    createdAt: Date.now(),
  };
  await env.ROUTES.put(slug, JSON.stringify(route));
  await updateOwnerIndex(ownerId, slug, env);
  await updateOwnerActivity(ownerId, env);

  return Response.json({ ok: true, payUrl: `https://pay.trnpk.net/${slug}`, splitterAddress, display: fee.display });
}

// ── Upload file ────────────────────────────────────────────────
async function handleUpload(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });

  const formData    = await request.formData();
  const file        = formData.get("file");
  const ownerId     = formData.get("ownerId");
  const price       = formData.get("price");
  const providerWallet = formData.get("providerWallet");
  const description = formData.get("description") ?? file?.name;

  if (!file || !ownerId || !price || !providerWallet) {
    return Response.json({ error: "file, ownerId, price, providerWallet required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: `File too large: ${(file.size/1024/1024).toFixed(1)} MB. Max: 50 MB` }, { status: 413 });
  }

  const limit = await getFileLimit(ownerId, env);
  if (!limit.allowed) {
    return Response.json({ error: "FILE_LIMIT_REACHED", count: limit.count, max: limit.max }, { status: 429 });
  }

  let fee;
  try { fee = calculateFee(parseInt(price)); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }

  const fileId = crypto.randomUUID();
  const ext    = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const r2Key  = `files/${ownerId}/${fileId}.${ext}`;

  await env.FILES.put(r2Key, file.stream(), {
    httpMetadata:   { contentType: file.type || "application/octet-stream" },
    customMetadata: { ownerId, originalName: file.name, price, fileSize: file.size.toString() },
  });

  const slug = await uniqueSlug(Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10), env);
  const splitterAddress = formData.get("splitterAddress") ?? providerWallet;

  const route = {
    type: "file", r2Key, fileName: file.name, fileSize: file.size,
    price, description, ownerId, providerWallet, splitterAddress,
    feeModel: fee.model, platformFee: fee.platformFee,
    createdAt: Date.now(), lastDownload: Date.now(),
  };
  await env.ROUTES.put(slug, JSON.stringify(route));
  await updateOwnerIndex(ownerId, slug, env);
  await updateOwnerActivity(ownerId, env);

  return Response.json({ ok: true, slug, payUrl: `https://pay.trnpk.net/${slug}`, fileId, fileName: file.name, display: fee.display });
}

// ── File limit check ───────────────────────────────────────────
async function handleLimitCheck(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });
  const ownerId = new URL(request.url).searchParams.get("ownerId");
  if (!ownerId) return Response.json({ error: "ownerId required" }, { status: 400 });
  return Response.json(await getFileLimit(ownerId, env));
}

async function getFileLimit(ownerId, env) {
  const slotRaw  = await env.ROUTES.get(`slots:${ownerId}`);
  const slotLimit = slotRaw ? parseInt(slotRaw) : 25;
  const indexRaw  = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs     = indexRaw ? JSON.parse(indexRaw) : [];
  let count = 0;
  for (const slug of slugs) {
    const raw = await env.ROUTES.get(slug);
    if (raw && JSON.parse(raw).type === "file") count++;
  }
  return { allowed: count < slotLimit, count, max: slotLimit, remaining: slotLimit - count };
}

// ── File meta / delete ─────────────────────────────────────────
async function handleFileMeta(request, env) {
  if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401 });
  const slug  = new URL(request.url).pathname.replace("/api/files/", "");
  const raw   = await env.ROUTES.get(slug);
  if (!raw) return new Response("Not found", { status: 404 });
  const route = JSON.parse(raw);
  const daysSince = route.lastDownload ? Math.floor((Date.now() - route.lastDownload) / 86400000) : 999;
  const daysUntilDelete = Math.max(0, DOWNLOAD_TTL_DAYS - daysSince);
  return Response.json({ slug, fileName: route.fileName, fileSize: route.fileSize, price: route.price, payUrl: `https://pay.trnpk.net/${slug}`, daysUntilDelete });
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
    const daysSince = r.lastDownload ? Math.floor((Date.now() - r.lastDownload) / 86400000) : 999;
    return {
      slug, type: r.type, description: r.description, fileName: r.fileName,
      fileSize: r.fileSize, price: fee.display.price, providerGets: fee.display.provider,
      feeLabel: fee.display.feeLabel, createdAt: r.createdAt,
      daysUntilDelete: r.type === "file" ? Math.max(0, DOWNLOAD_TTL_DAYS - daysSince) : null,
      payUrl: `https://pay.trnpk.net/${slug}`,
    };
  }));
  return Response.json(routes.filter(Boolean));
}

// ── Splitter wallet ────────────────────────────────────────────
async function createSplitterWallet({ providerWallet, priceUnits, platformFee, env }) {
  const providerPct = Math.round(((priceUnits - platformFee) / priceUnits) * 100);
  const platformPct = 100 - providerPct;

  try {
    const walletRes = await cdpFetch(`${CDP_BASE}/wallets`, "POST", { wallet: { network_id: "base-mainnet" } }, env);
    if (!walletRes.ok) throw new Error(`CDP ${walletRes.status}`);
    const wallet = await walletRes.json();
    if (!wallet?.default_address?.address_id) throw new Error("CDP response missing address");
    const splitterAddress = wallet.default_address.address_id;

    await cdpFetch(`${CDP_BASE}/wallets/${wallet.id}/webhook_rules`, "POST", {
      event_type: "erc20_transfer", asset: "usdc", trigger: "on_receive",
      actions: [
        { type: "transfer", to: providerWallet,      percentage: providerPct, asset: "usdc", network_id: "base-mainnet" },
        { type: "transfer", to: env.PLATFORM_WALLET, percentage: platformPct, asset: "usdc", network_id: "base-mainnet" },
      ],
    }, env);

    return splitterAddress;
  } catch (err) {
    // CDP not configured yet — payments go directly to provider (no platform split)
    console.error("Splitter wallet creation failed, using provider wallet directly:", err.message);
    return providerWallet;
  }
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
      await env.ROUTES.delete(`owner:${ownerId}`);
      await env.ROUTES.delete(`activity:${ownerId}`);
      await env.ROUTES.delete(`slots:${ownerId}`);
      continue;
    }

    const indexRaw = await env.ROUTES.get(name);
    const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
    for (const slug of slugs) {
      const raw = await env.ROUTES.get(slug);
      if (!raw) continue;
      const route = JSON.parse(raw);
      if (route.type !== "file") continue;
      const daysSince = (now - route.lastDownload) / 86400000;
      if (daysSince >= DOWNLOAD_TTL_DAYS) {
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
  let deleted = 0;
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
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);
}

async function uniqueSlug(base, env) {
  let slug = base;
  let i = 1;
  while (await env.ROUTES.get(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function checkAuth(request, env) {
  return request.headers.get("Authorization") === `Bearer ${env.ADMIN_SECRET}`;
}

function b64url(input) {
  let b64;
  if (input instanceof ArrayBuffer) {
    b64 = btoa(String.fromCharCode(...new Uint8Array(input)));
  } else {
    b64 = btoa(input);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function makeCdpJwt(method, url, env) {
  const keyData = Uint8Array.from(atob(env.CDP_API_KEY), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", keyData.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
  const now = Math.floor(Date.now() / 1000);
  const { host, pathname } = new URL(url);
  const keyName = `organizations/${env.CDP_PROJECT_ID}/apiKeys/${env.CDP_KEY_ID}`;
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join('');
  const header  = b64url(JSON.stringify({ alg: "ES256", kid: keyName, typ: "JWT", nonce }));
  const payload = b64url(JSON.stringify({
    sub: keyName, iss: "cdp",
    nbf: now, exp: now + 120, iat: now,
    uris: [`${method} ${host}${pathname}`],
  }));
  const sigInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(sigInput)
  );
  return `${sigInput}.${b64url(sig)}`;
}

async function cdpFetch(url, method, body, env) {
  const jwt = await makeCdpJwt(method, url, env);
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

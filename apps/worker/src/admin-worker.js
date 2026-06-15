/**
 * Turnpike — Admin API Worker
 * admin-worker.trnpk.net
 * Access restricted — no login form. Protected by SUPER_ADMIN_SECRET.
 *
 * Endpoints:
 *   GET    /api/admin/stats
 *   GET    /api/admin/users            ?role=all|publisher|consumer|suspended
 *   GET    /api/admin/users/:id
 *   POST   /api/admin/users/:id/suspend
 *   POST   /api/admin/users/:id/unsuspend
 *   POST   /api/admin/users/:id/grant-publisher
 *   POST   /api/admin/users/:id/revoke-publisher
 *   DELETE /api/admin/users/:id        (close account)
 *   DELETE /api/admin/users/:id/files  (delete all files, keep account)
 *   DELETE /api/admin/files/:slug      (delete single file)
 *   PATCH  /api/admin/users/:id/slots  (adjust slot limit)
 */

export default {
  async fetch(request, env) {
    const auth = request.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${env.SUPER_ADMIN_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // CORS for admin app
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url   = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // parts: ["api", "admin", resource, id?, action?]
    const resource = parts[2];
    const id       = parts[3];
    const action   = parts[4];

    try {
      if (resource === "stats" && request.method === "GET")
        return withCors(await handleStats(env));

      if (resource === "revenue" && request.method === "GET")
        return withCors(await handleRevenue(env));

      if (resource === "users" && !id && request.method === "GET")
        return withCors(await handleListUsers(request, env));

      if (resource === "users" && id && !action && request.method === "GET")
        return withCors(await handleUserDetail(id, env));

      if (resource === "users" && action === "suspend" && request.method === "POST")
        return withCors(await handleSuspendUser(id, true, env));

      if (resource === "users" && action === "unsuspend" && request.method === "POST")
        return withCors(await handleSuspendUser(id, false, env));

      if (resource === "users" && action === "grant-publisher" && request.method === "POST")
        return withCors(await handleGrantPublisher(id, env));

      if (resource === "users" && action === "revoke-publisher" && request.method === "POST")
        return withCors(await handleRevokePublisher(id, env));

      if (resource === "users" && action === "files" && request.method === "DELETE")
        return withCors(await handleDeleteAllFiles(id, env));

      if (resource === "users" && !action && request.method === "DELETE")
        return withCors(await handleCloseAccount(id, env));

      if (resource === "files" && id && request.method === "DELETE")
        return withCors(await handleDeleteFile(id, env));

      if (resource === "users" && action === "slots" && request.method === "PATCH")
        return withCors(await handleUpdateSlots(id, request, env));

      return withCors(new Response("Not found", { status: 404 }));
    } catch (err) {
      console.error(err);
      return withCors(Response.json({ error: "Internal error" }, { status: 500 }));
    }
  },
};

// ── Supabase helpers ───────────────────────────────────────────
async function supabase(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey":        env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${text}`);
  }
  return res;
}

// ── Revenue ────────────────────────────────────────────────────
async function handleRevenue(env) {
  const [purchasesRes, contentRes, usersRes] = await Promise.all([
    supabase(env, "/purchases?select=slug,user_id,paid_at"),
    supabase(env, "/content?select=slug,price_units,owner_id"),
    supabase(env, "/users?select=id,email"),
  ]);
  const purchases = await purchasesRes.json();
  const content   = await contentRes.json();
  const users     = await usersRes.json();

  const contentBySlug = Object.fromEntries(content.map(c => [c.slug, c]));
  const userById      = Object.fromEntries(users.map(u => [u.id, u.email]));

  function calcFee(priceUnits) {
    return priceUnits < 100_000 ? 10_000 : Math.round(priceUnits * 0.10);
  }

  let totalRevenue = 0, totalFee = 0;
  const byPublisher = {};

  for (const p of purchases) {
    const c = contentBySlug[p.slug];
    if (!c) continue;
    const price = c.price_units;
    const fee   = calcFee(price);
    totalRevenue += price;
    totalFee     += fee;
    const ownerId = c.owner_id;
    if (!byPublisher[ownerId]) {
      byPublisher[ownerId] = { email: userById[ownerId] ?? ownerId, revenue: 0, fee: 0, sales: 0 };
    }
    byPublisher[ownerId].revenue += price;
    byPublisher[ownerId].fee     += fee;
    byPublisher[ownerId].sales   += 1;
  }

  return Response.json({
    totalRevenue,
    totalFee,
    byPublisher: Object.values(byPublisher).sort((a, b) => b.revenue - a.revenue),
  });
}

// ── Stats ──────────────────────────────────────────────────────
async function handleStats(env) {
  const usersRes = await supabase(env, "/users?select=id,is_publisher,suspended");
  const users    = await usersRes.json();

  const totalUsers      = users.length;
  const publishers      = users.filter(u => u.is_publisher).length;
  const consumers       = users.filter(u => !u.is_publisher).length;
  const suspended       = users.filter(u => u.suspended).length;

  // Count files from KV
  const { keys } = await env.ROUTES.list({ prefix: "owner:" });
  let totalFiles = 0;
  for (const { name } of keys) {
    const raw  = await env.ROUTES.get(name);
    const slugs = raw ? JSON.parse(raw) : [];
    for (const slug of slugs) {
      const r = await env.ROUTES.get(slug);
      if (r && JSON.parse(r).type === "file") totalFiles++;
    }
  }

  return Response.json({ totalUsers, publishers, consumers, suspended, totalFiles });
}

// ── List all users ─────────────────────────────────────────────
async function handleListUsers(request, env) {
  const url    = new URL(request.url);
  const role   = url.searchParams.get("role") ?? "all";
  const search = url.searchParams.get("search")?.toLowerCase() ?? "";

  let query = "/users?select=id,email,is_publisher,suspended,wallet_address,created_at,last_active_at";
  if (role === "publisher")  query += "&is_publisher=eq.true";
  if (role === "consumer")   query += "&is_publisher=eq.false";
  if (role === "suspended")  query += "&suspended=eq.true";
  query += "&order=last_active_at.desc";

  const res   = await supabase(env, query);
  const users = await res.json();

  const filtered = search
    ? users.filter(u => u.email.toLowerCase().includes(search) || u.id.includes(search))
    : users;

  // Enrich with file count from KV (only for publishers)
  const enriched = await Promise.all(filtered.map(async u => {
    let fileCount = 0;
    if (u.is_publisher) {
      const indexRaw = await env.ROUTES.get(`owner:${u.id}`);
      const slugs = indexRaw ? JSON.parse(indexRaw) : [];
      for (const slug of slugs) {
        const r = await env.ROUTES.get(slug);
        if (r && JSON.parse(r).type === "file") fileCount++;
      }
    }
    const slotRaw = await env.ROUTES.get(`slots:${u.id}`);
    const slotLimit = slotRaw ? parseInt(slotRaw) : 25;
    return { ...u, fileCount, slotLimit };
  }));

  return Response.json(enriched);
}

// ── User detail ────────────────────────────────────────────────
async function handleUserDetail(userId, env) {
  const res  = await supabase(env, `/users?id=eq.${userId}&select=*`);
  const rows = await res.json();
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });
  const user = rows[0];

  const indexRaw  = await env.ROUTES.get(`owner:${userId}`);
  const slugs     = indexRaw ? JSON.parse(indexRaw) : [];
  const slotRaw   = await env.ROUTES.get(`slots:${userId}`);
  const slotLimit = slotRaw ? parseInt(slotRaw) : 25;

  const files = await Promise.all(slugs.map(async slug => {
    const raw = await env.ROUTES.get(slug);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (r.type !== "file") return null;
    const daysSince = r.lastDownload ? Math.floor((Date.now() - r.lastDownload) / 86400000) : 999;
    return {
      slug, fileName: r.fileName, fileSize: r.fileSize,
      price: r.price, createdAt: r.createdAt,
      daysUntilDelete: Math.max(0, 30 - daysSince),
      payUrl: `https://trnpk.net/${slug}`,
    };
  }));

  return Response.json({ ...user, slotLimit, files: files.filter(Boolean) });
}

// ── Suspend / unsuspend user ───────────────────────────────────
async function handleSuspendUser(userId, suspend, env) {
  // Update Supabase
  await supabase(env, `/users?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ suspended: suspend }),
  });

  // Suspend/restore all routes in KV
  const indexRaw = await env.ROUTES.get(`owner:${userId}`);
  const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
  for (const slug of slugs) {
    const raw = await env.ROUTES.get(slug);
    if (!raw) continue;
    const route = JSON.parse(raw);
    route.suspended = suspend;
    await env.ROUTES.put(slug, JSON.stringify(route));
  }

  return Response.json({ ok: true, userId, suspended: suspend });
}

// ── Grant / revoke publisher role ──────────────────────────────
async function handleGrantPublisher(userId, env) {
  await supabase(env, `/users?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_publisher: true }),
  });
  return Response.json({ ok: true, userId, is_publisher: true });
}

async function handleRevokePublisher(userId, env) {
  // Revoke role and delete all files
  await handleDeleteAllFiles(userId, env);
  await supabase(env, `/users?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_publisher: false }),
  });
  return Response.json({ ok: true, userId, is_publisher: false });
}

// ── Delete all files ───────────────────────────────────────────
async function handleDeleteAllFiles(ownerId, env) {
  const indexRaw = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
  let deleted = 0;
  const remaining = [];
  for (const slug of slugs) {
    const raw = await env.ROUTES.get(slug);
    if (!raw) continue;
    const route = JSON.parse(raw);
    if (route.type === "file") {
      if (route.r2Key) await env.FILES.delete(route.r2Key);
      await env.ROUTES.delete(slug);
      deleted++;
    } else {
      remaining.push(slug);
    }
  }
  await env.ROUTES.put(`owner:${ownerId}`, JSON.stringify(remaining));
  return Response.json({ ok: true, deleted });
}

// ── Delete single file ─────────────────────────────────────────
async function handleDeleteFile(slug, env) {
  const raw = await env.ROUTES.get(slug);
  if (!raw) return Response.json({ error: "Not found" }, { status: 404 });
  const route = JSON.parse(raw);
  if (route.r2Key) await env.FILES.delete(route.r2Key);
  await env.ROUTES.delete(slug);
  const indexKey = `owner:${route.ownerId}`;
  const indexRaw = await env.ROUTES.get(indexKey);
  if (indexRaw) {
    await env.ROUTES.put(indexKey, JSON.stringify(JSON.parse(indexRaw).filter(s => s !== slug)));
  }
  return Response.json({ ok: true, deleted: slug });
}

// ── Close account ──────────────────────────────────────────────
async function handleCloseAccount(userId, env) {
  await handleDeleteAllFiles(userId, env);
  await env.ROUTES.delete(`owner:${userId}`);
  await env.ROUTES.delete(`activity:${userId}`);
  await env.ROUTES.delete(`slots:${userId}`);
  // Delete from Supabase (cascade deletes auth user via trigger)
  await supabase(env, `/users?id=eq.${userId}`, { method: "DELETE" });
  return Response.json({ ok: true, userId, closed: true });
}

// ── Update slot limit ──────────────────────────────────────────
async function handleUpdateSlots(userId, request, env) {
  const { newLimit } = await request.json();
  if (!newLimit || newLimit < 1 || newLimit > 1000) {
    return Response.json({ error: "newLimit must be 1–1000" }, { status: 400 });
  }
  await env.ROUTES.put(`slots:${userId}`, newLimit.toString());
  return Response.json({ ok: true, userId, newLimit });
}

// ── CORS helpers ───────────────────────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

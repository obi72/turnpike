/**
 * Turnpike — Admin API Worker
 * Runs on admin.trnpk.net — protected by SUPER_ADMIN_SECRET.
 *
 * Endpoints:
 *   GET    /api/admin/stats
 *   GET    /api/admin/owners
 *   GET    /api/admin/owners/:id
 *   DELETE /api/admin/files/:slug
 *   DELETE /api/admin/owners/:id/files
 *   POST   /api/admin/owners/:id/suspend
 *   POST   /api/admin/owners/:id/unsuspend
 *   DELETE /api/admin/owners/:id
 *   PATCH  /api/admin/owners/:id/slots
 */

const DEFAULT_SLOT_LIMIT = 25;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const auth = request.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${env.SUPER_ADMIN_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const parts = new URL(request.url).pathname.split("/").filter(Boolean);
    // parts: ["api", "admin", resource, id?, action?]

    let response;
    if (parts[2] === "stats"  && request.method === "GET")    response = await handleStats(env);
    else if (parts[2] === "owners" && !parts[3] && request.method === "GET")    response = await handleListOwners(request, env);
    else if (parts[2] === "owners" && parts[3] && !parts[4] && request.method === "GET") response = await handleOwnerDetail(parts[3], env);
    else if (parts[2] === "files"  && parts[3] && request.method === "DELETE")  response = await handleDeleteFile(parts[3], env);
    else if (parts[2] === "owners" && parts[4] === "files"     && request.method === "DELETE") response = await handleDeleteAllFiles(parts[3], env);
    else if (parts[2] === "owners" && parts[4] === "suspend"   && request.method === "POST")   response = await handleSuspend(parts[3], true, env);
    else if (parts[2] === "owners" && parts[4] === "unsuspend" && request.method === "POST")   response = await handleSuspend(parts[3], false, env);
    else if (parts[2] === "owners" && parts[3] && !parts[4] && request.method === "DELETE")    response = await handleCloseAccount(parts[3], env);
    else if (parts[2] === "owners" && parts[4] === "slots"     && request.method === "PATCH")  response = await handleUpdateSlots(parts[3], request, env);
    else response = new Response("Not found", { status: 404 });

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

async function handleStats(env) {
  const { keys } = await env.ROUTES.list({ prefix: "owner:" });
  let totalOwners = 0, totalFiles = 0, suspendedCount = 0;
  for (const { name } of keys) {
    totalOwners++;
    const ownerId  = name.replace("owner:", "");
    const status   = await env.ROUTES.get(`status:${ownerId}`);
    if (status === "suspended") suspendedCount++;
    const indexRaw = await env.ROUTES.get(name);
    const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
    for (const slug of slugs) {
      const raw = await env.ROUTES.get(slug);
      if (raw && JSON.parse(raw).type === "file") totalFiles++;
    }
  }
  return Response.json({ totalOwners, totalFiles, suspendedCount });
}

async function handleListOwners(request, env) {
  const { keys } = await env.ROUTES.list({ prefix: "owner:" });
  const search   = new URL(request.url).searchParams.get("search")?.toLowerCase() ?? "";
  const owners   = await Promise.all(keys.map(async ({ name }) => {
    const ownerId     = name.replace("owner:", "");
    const indexRaw    = await env.ROUTES.get(name);
    const slugs       = indexRaw ? JSON.parse(indexRaw) : [];
    const activityRaw = await env.ROUTES.get(`activity:${ownerId}`);
    const statusRaw   = await env.ROUTES.get(`status:${ownerId}`);
    const slotRaw     = await env.ROUTES.get(`slots:${ownerId}`);
    const slotLimit   = slotRaw ? parseInt(slotRaw) : DEFAULT_SLOT_LIMIT;
    let fileCount = 0;
    for (const slug of slugs) {
      const raw = await env.ROUTES.get(slug);
      if (raw && JSON.parse(raw).type === "file") fileCount++;
    }
    return {
      ownerId, fileCount, slotLimit,
      lastActivity: activityRaw ? parseInt(activityRaw) : null,
      status: statusRaw ?? "active",
    };
  }));
  const filtered = search ? owners.filter(o => o.ownerId.toLowerCase().includes(search)) : owners;
  filtered.sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));
  return Response.json(filtered);
}

async function handleOwnerDetail(ownerId, env) {
  const indexRaw  = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs     = indexRaw ? JSON.parse(indexRaw) : [];
  const slotRaw   = await env.ROUTES.get(`slots:${ownerId}`);
  const slotLimit = slotRaw ? parseInt(slotRaw) : DEFAULT_SLOT_LIMIT;
  const files = await Promise.all(slugs.map(async slug => {
    const raw = await env.ROUTES.get(slug);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (r.type !== "file") return null;
    const daysSince = r.lastDownload ? Math.floor((Date.now() - r.lastDownload) / 86400000) : 999;
    return {
      slug, fileName: r.fileName, fileSize: r.fileSize, price: r.price,
      createdAt: r.createdAt,
      daysUntilDelete: Math.max(0, 30 - daysSince),
      payUrl: `https://pay.trnpk.net/${slug}`,
    };
  }));
  const activityRaw = await env.ROUTES.get(`activity:${ownerId}`);
  const statusRaw   = await env.ROUTES.get(`status:${ownerId}`);
  return Response.json({
    ownerId,
    status: statusRaw ?? "active",
    lastActivity: activityRaw ? parseInt(activityRaw) : null,
    slotLimit,
    files: files.filter(Boolean),
  });
}

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

async function handleDeleteAllFiles(ownerId, env) {
  const indexRaw = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
  let deleted    = 0;
  for (const slug of slugs) {
    const raw = await env.ROUTES.get(slug);
    if (!raw) continue;
    const route = JSON.parse(raw);
    if (route.type !== "file") continue;
    if (route.r2Key) await env.FILES.delete(route.r2Key);
    await env.ROUTES.delete(slug);
    deleted++;
  }
  const remaining = slugs.filter(async s => await env.ROUTES.get(s));
  await env.ROUTES.put(`owner:${ownerId}`, JSON.stringify(remaining));
  return Response.json({ ok: true, deleted });
}

async function handleSuspend(ownerId, suspend, env) {
  await env.ROUTES.put(`status:${ownerId}`, suspend ? "suspended" : "active");
  const indexRaw = await env.ROUTES.get(`owner:${ownerId}`);
  const slugs    = indexRaw ? JSON.parse(indexRaw) : [];
  for (const slug of slugs) {
    const raw = await env.ROUTES.get(slug);
    if (!raw) continue;
    const route = JSON.parse(raw);
    route.suspended = suspend;
    await env.ROUTES.put(slug, JSON.stringify(route));
  }
  return Response.json({ ok: true, ownerId, status: suspend ? "suspended" : "active" });
}

async function handleCloseAccount(ownerId, env) {
  await handleDeleteAllFiles(ownerId, env);
  await env.ROUTES.delete(`owner:${ownerId}`);
  await env.ROUTES.delete(`activity:${ownerId}`);
  await env.ROUTES.delete(`status:${ownerId}`);
  await env.ROUTES.delete(`slots:${ownerId}`);
  return Response.json({ ok: true, ownerId, closed: true });
}

async function handleUpdateSlots(ownerId, request, env) {
  const { newLimit } = await request.json();
  if (!newLimit || newLimit < 1 || newLimit > 1000) {
    return Response.json({ error: "newLimit must be between 1 and 1000" }, { status: 400 });
  }
  await env.ROUTES.put(`slots:${ownerId}`, newLimit.toString());
  return Response.json({ ok: true, ownerId, newLimit });
}

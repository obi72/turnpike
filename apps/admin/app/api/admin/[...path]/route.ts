import { NextRequest, NextResponse } from "next/server";

const ADMIN_WORKER_URL  = process.env.ADMIN_WORKER_URL  ?? "https://turnpike-admin.worzyk.workers.dev";
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET ?? "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  const path   = params.path.join("/");
  const search = req.nextUrl.search ?? "";
  const url    = `${ADMIN_WORKER_URL}/api/admin/${path}${search}`;

  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

  const res = await fetch(url, {
    method:  req.method,
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${SUPER_ADMIN_SECRET}`,
    },
    body,
  });

  const data = await res.text();
  return new NextResponse(data, {
    status:  res.status,
    headers: { "Content-Type": "application/json" },
  });
}

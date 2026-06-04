import { NextResponse, type NextRequest } from "next/server";
import { adminFetch } from "@/lib/admin-api";

type Params = Promise<{ id: string; action: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { id, action } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const data = await adminFetch(`/users/${id}/${action}`, {
      method: "POST",
      body:   JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const { id, action } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const data = await adminFetch(`/users/${id}/${action}`, {
      method: "PATCH",
      body:   JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  const { id, action } = await params;
  try {
    const data = await adminFetch(`/users/${id}/${action}`, { method: "DELETE" });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

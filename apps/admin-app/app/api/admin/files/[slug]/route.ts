import { NextResponse, type NextRequest } from "next/server";
import { adminFetch } from "@/lib/admin-api";

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const data = await adminFetch(`/files/${slug}`, { method: "DELETE" });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

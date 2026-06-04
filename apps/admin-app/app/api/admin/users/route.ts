import { NextResponse, type NextRequest } from "next/server";
import { adminFetch } from "@/lib/admin-api";

export async function GET(request: NextRequest) {
  const search = new URL(request.url).searchParams;
  const qs = search.toString();
  try {
    const data = await adminFetch(`/users${qs ? `?${qs}` : ""}`);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

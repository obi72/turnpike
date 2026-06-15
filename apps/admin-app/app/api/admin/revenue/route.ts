import { NextResponse } from "next/server";
import { adminFetch } from "@/lib/admin-api";

export async function GET() {
  try {
    const data = await adminFetch("/revenue");
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

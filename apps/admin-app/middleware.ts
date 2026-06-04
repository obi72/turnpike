import { NextResponse, type NextRequest } from "next/server";

/**
 * Basic auth middleware — used when Vercel Password Protection is not available.
 * Set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD in Vercel environment variables.
 * On Vercel Pro+, use Vercel Password Protection instead and remove this middleware.
 */
export function middleware(request: NextRequest) {
  // Skip API routes (they are protected by SUPER_ADMIN_SECRET)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const user     = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // If credentials aren't configured, allow access (rely on Vercel Password Protection)
  if (!user || !password) return NextResponse.next();

  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = authHeader.split(" ");

  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [u, p]  = decoded.split(":");
    if (u === user && p === password) return NextResponse.next();
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="Turnpike Admin"` },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

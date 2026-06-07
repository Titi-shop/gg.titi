import { NextRequest, NextResponse } from "next/server";

const PI_ONLY =
  process.env.PI_BROWSER_ONLY === "false";

function isPiBrowser(req: NextRequest): boolean {
  const ua =
    req.headers.get("user-agent") || "";

  return (
    ua.includes("PiBrowser") ||
    ua.includes("Pi Browser") ||
    ua.includes("PiNetwork") ||
    ua.includes("minepi") ||
    ua.includes("wallet.pi")
  );
}

export function middleware(
  req: NextRequest
) {
  if (!PI_ONLY) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // allow static
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const secFetchDest =
    req.headers.get("sec-fetch-dest") || "";

  const isDocument =
    secFetchDest === "document";

  if (isDocument && !isPiBrowser(req)) {
    return NextResponse.rewrite(
      new URL("/pi-required", req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};

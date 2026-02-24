import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "qualia_beta";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/session")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("gate", "beta");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/session/:path*"],
};

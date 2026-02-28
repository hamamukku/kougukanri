import { NextRequest, NextResponse } from "next/server";

const AUTH_TOKEN_COOKIE = "auth_token";
const AUTH_ROLE_COOKIE = "role";

function createLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicPath = pathname === "/login" || pathname === "/signup-request";

  if (isPublicPath) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const role = request.cookies.get(AUTH_ROLE_COOKIE)?.value ?? "user";

  if (!token) {
    return createLoginRedirect(request);
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/tools";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*|login).*)"],
};

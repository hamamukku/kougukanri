import { NextRequest, NextResponse } from "next/server";

function createLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPath = pathname === "/login";
  const hasAuth = request.cookies.get("auth")?.value === "1";
  const role = request.cookies.get("role")?.value ?? "user";

  if (isLoginPath) {
    return NextResponse.next();
  }

  if (!hasAuth) {
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

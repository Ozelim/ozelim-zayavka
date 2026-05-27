import { NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API = new Set(["/api/login", "/api/logout"]);

function isPublic(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_API.has(pathname)) return true;
  return false;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  const isModerator =
    !!session && String(session.role).toUpperCase() === "MODERATOR";

  if (pathname === "/login" && isModerator) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!isModerator) {
    if (isApi) {
      return NextResponse.json(
        { error: session ? "Нет доступа" : "Требуется авторизация" },
        { status: session ? 403 : 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};

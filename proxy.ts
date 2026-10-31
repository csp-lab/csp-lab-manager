import { NextResponse, type NextRequest } from "next/server";
import { readSessionUser } from "@/lib/session";
import { canManageEndpoints, canManageUsers } from "@/lib/rbac";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const user = await readSessionUser(request.headers);
  const loginPath = pathname === "/admin/login";

  if (loginPath) {
    if (user) return NextResponse.redirect(new URL("/admin/endpoints", request.url));
    return NextResponse.next();
  }

  if (!user) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin/users") && !canManageUsers(user.role)) {
    return NextResponse.redirect(new URL("/admin/endpoints", request.url));
  }

  if (pathname.startsWith("/admin/endpoints/new") && !canManageEndpoints(user.role)) {
    return NextResponse.redirect(new URL("/admin/endpoints", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

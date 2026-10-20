import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, Role } from "@/lib/supabase/types";

// Protected areas and the roles allowed in. Mirrors areaRoles in src/lib/auth.ts
// (the proxy can't share server-only modules).
const areas: { prefix: string; roles: Role[] }[] = [
  { prefix: "/staff", roles: ["staff", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const area = areas.find((a) => request.nextUrl.pathname === a.prefix || request.nextUrl.pathname.startsWith(`${a.prefix}/`));

  if (!url || !key) {
    // Not configured (e.g. mock-data preview): nothing to refresh, and the
    // protected areas stay closed.
    return area ? NextResponse.rewrite(new URL("/not-allowed", request.url), { status: 403 }) : NextResponse.next();
  }

  // Refresh the session and pass the updated cookies on to the page.
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!area) return response;

  const withCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return withCookies(NextResponse.redirect(login));
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !area.roles.includes(profile.role)) {
    return withCookies(NextResponse.rewrite(new URL("/not-allowed", request.url), { status: 403 }));
  }

  return response;
}

export const config = {
  // Everything except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};

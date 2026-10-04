import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/navigation";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeInternalPath(requestUrl.searchParams.get("next"), "/update-password");
  const origin = process.env.NODE_ENV === "production"
    ? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr").origin
    : requestUrl.origin;

  if (!tokenHash || type !== "recovery") return invalidTokenRedirect(origin);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return invalidTokenRedirect(origin);

  const pendingCookies: PendingCookie[] = [];
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => { pendingCookies.push(...cookies); },
    },
  });
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error) return invalidTokenRedirect(origin);

  const response = NextResponse.redirect(new URL(next, origin), 303);
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function invalidTokenRedirect(origin: string) {
  const target = new URL("/member-access", origin);
  target.searchParams.set("error", "invalid_recovery");
  return NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "private, no-store" } });
}

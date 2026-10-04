import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("utm_source")?.slice(0, 80) || "direct";
  const admin = createAdminClient();
  if (admin && !/bot|crawler|spider|headless/i.test(request.headers.get("user-agent") ?? "")) {
    await admin.from("growth_events").insert({ event_name: "apk_download_started", source });
  }
  const response = NextResponse.redirect(new URL("/lovask.apk?v=39", process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr"), 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

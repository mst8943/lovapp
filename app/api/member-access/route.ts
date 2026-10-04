import { NextResponse, type NextRequest } from "next/server";
import { hasValidAuthOrigin } from "@/lib/auth-origin";
import { createFreshMemberRecoveryLink, verifyAccessGrant } from "@/lib/membership-access";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasValidAuthOrigin(request)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const form = await request.formData();
  const grant = String(form.get("grant") ?? "");
  const verified = verifyAccessGrant(grant);
  if (!verified) return NextResponse.redirect(new URL("/member-access?error=invalid", request.url), 303);
  const limited = rateLimitResponse(await consumeRateLimit(request, {
    scope: "membership.access.create",
    identity: verified.applicationId,
    limit: 5,
    windowSeconds: 60 * 60,
  }));
  if (limited) return limited;
  const admin = createAdminClient();
  if (!admin) return NextResponse.redirect(errorUrl(request, grant), 303);
  const { data: application } = await admin.from("membership_applications")
    .select("id,email,full_name,application_code,status")
    .eq("id", verified.applicationId).maybeSingle();
  if (!application || !["approved", "invited"].includes(application.status)) {
    return NextResponse.redirect(new URL("/member-access?error=invalid", request.url), 303);
  }
  try {
    const actionLink = await createFreshMemberRecoveryLink(admin, application);
    return NextResponse.redirect(actionLink, 303);
  } catch {
    return NextResponse.redirect(errorUrl(request, grant), 303);
  }
}

function errorUrl(request: NextRequest, grant: string) {
  const target = new URL("/member-access", request.url);
  target.searchParams.set("grant", grant);
  target.searchParams.set("error", "generate");
  return target;
}

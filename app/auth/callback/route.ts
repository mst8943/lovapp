import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/navigation";
import { readOpenRegistration } from "@/lib/registration-settings";
import { notifyHermes } from "@/lib/hermes-notifications";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const flow = url.searchParams.get("flow");
  const next = safeInternalPath(url.searchParams.get("next"), "/onboarding");
  const origin = process.env.NODE_ENV === "production"
    ? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr").origin
    : url.origin;

  if (url.searchParams.has("error")) return authRedirect(origin, "oauth_cancelled");

  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return authRedirect(origin, "oauth_exchange_failed");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return authRedirect(origin, "oauth_exchange_failed");

    if (user.app_metadata.approved_member !== true) {
      const admin = createAdminClient();
      if (!admin) {
        await supabase.auth.signOut();
        return authRedirect(origin, "auth_unavailable");
      }

      // New Google users often press "log in"; open registration admits them on either flow.
      const registration = await readOpenRegistration(admin);
      if (registration?.enabled && !registration.error) {
        const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
          app_metadata: { ...user.app_metadata, approved_member: true, registration_source: "open_google" },
        });
        if (!metadataError) {
          await admin.from("product_funnel_events").insert({ event_name: "signup_completed", subject_id: user.id, source: "web" });
          await notifyHermes({ title: "Yeni Lovask üyeliği", fields: { platform: "web", provider: "Google" }, dedupeKey: `signup:${user.id}` });
          // Include the new approval in the JWT used by onboarding RPCs.
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !data.session) {
            await supabase.auth.signOut();
            return authRedirect(origin, "auth_unavailable");
          }
          return NextResponse.redirect(new URL(next, origin), { headers: { "Cache-Control": "private, no-store" } });
        }
      }

      await supabase.auth.signOut();
      // Only remove the account this OAuth attempt just created; never an older pending account.
      const createdByThisAttempt = user.identities?.every((identity) => identity.provider === "google")
        && Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;
      if (createdByThisAttempt) await admin.auth.admin.deleteUser(user.id);
      return authRedirect(origin, registration.error ? "auth_unavailable" : registration.enabled ? "auth_unavailable" : flow === "register" ? "registration_closed" : "application_required");
    }
  }

  return NextResponse.redirect(new URL(next, origin), { headers: { "Cache-Control": "private, no-store" } });
}

function authRedirect(origin: string, error: string) {
  const target = new URL("/login", origin);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target, { headers: { "Cache-Control": "private, no-store" } });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { readVerificationSettings } from "@/lib/verification-settings";
import { readProviderConfig, saveProviderConfig } from "@/lib/verification-providers";

const settings = z.object({ action: z.literal("settings"), emailEnabled: z.boolean(), smsEnabled: z.boolean() });
const review = z.object({ action: z.literal("review"), requestId: z.string().uuid(), status: z.enum(["approved", "rejected"]) });
const providerSchema = z.object({ action: z.literal("provider"), resendApiKey: z.string().trim().max(300).optional(), resendFromEmail: z.union([z.literal(""), z.email()]).optional(), resendFromName: z.string().trim().max(80).optional(), netgsmUsercode: z.string().trim().max(100).optional(), netgsmPassword: z.string().max(200).optional(), netgsmMsgheader: z.string().trim().max(30).optional() });

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const [flags, requests] = await Promise.all([
    readVerificationSettings(auth.admin),
    auth.admin.from("profile_verification_requests").select("id,profile_id,selfie_path,status,created_at,profiles(display_name)").eq("status", "pending").not("selfie_path", "is", null).order("created_at").limit(100),
  ]);
  if (flags.error || requests.error) return NextResponse.json({ error: "Doğrulama ayarları yüklenemedi." }, { status: 503 });
  let provider;
  try { provider = await readProviderConfig(auth.admin); }
  catch { return NextResponse.json({ error: "Sağlayıcı ayarları çözülemedi. VERIFICATION_SETTINGS_KEY değerini kontrol et." }, { status: 503 }); }
  const pending = await Promise.all((requests.data ?? []).map(async (item) => {
    const [{ data }, { data: photo }] = await Promise.all([
      auth.admin.storage.from("verification-selfies").createSignedUrl(item.selfie_path, 900),
      auth.admin.from("profile_photos").select("storage_path").eq("profile_id", item.profile_id).eq("is_primary", true).maybeSingle(),
    ]);
    const { data: primary } = photo?.storage_path ? await auth.admin.storage.from("profiles").createSignedUrl(photo.storage_path, 900) : { data: null };
    return { ...item, selfie_path: undefined, selfieUrl: data?.signedUrl ?? null, profileUrl: primary?.signedUrl ?? null };
  }));
  return NextResponse.json({ emailEnabled: flags.emailEnabled, smsEnabled: flags.smsEnabled, pending,
    providers: { email: Boolean(provider.resendApiKey && provider.resendFromEmail), sms: Boolean(provider.netgsmUsercode && provider.netgsmPassword && provider.netgsmMsgheader) },
    providerValues: { resendFromEmail: provider.resendFromEmail, resendFromName: provider.resendFromName, netgsmUsercode: provider.netgsmUsercode, netgsmMsgheader: provider.netgsmMsgheader, resendApiKeySet: Boolean(provider.resendApiKey), netgsmPasswordSet: Boolean(provider.netgsmPassword), encryptionReady: Boolean(process.env.VERIFICATION_SETTINGS_KEY) } },
  { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const providerInput = providerSchema.safeParse(body);
  if (providerInput.success) {
    if (!process.env.VERIFICATION_SETTINGS_KEY) return NextResponse.json({ error: "Sunucuda VERIFICATION_SETTINGS_KEY eksik." }, { status: 409 });
    try {
      const current = await readProviderConfig(auth.admin);
      const next = { ...current, ...Object.fromEntries(Object.entries(providerInput.data).filter(([key, value]) => key !== "action" && value !== "" && value !== undefined)) };
      const { error } = await saveProviderConfig(auth.admin, next);
      if (error) return NextResponse.json({ error: "Sağlayıcı bilgileri kaydedilemedi." }, { status: 503 });
      await auth.session.rpc("write_admin_audit", { event_action: "platform.verification_provider.updated", event_target_type: "platform_settings", event_target_id: "global", event_metadata: { emailReady: Boolean(next.resendApiKey && next.resendFromEmail), smsReady: Boolean(next.netgsmUsercode && next.netgsmPassword && next.netgsmMsgheader) } });
      return NextResponse.json({ ok: true });
    } catch { return NextResponse.json({ error: "Sağlayıcı bilgileri çözülemedi." }, { status: 503 }); }
  }
  const flags = settings.safeParse(body);
  if (flags.success) {
    let provider;
    try { provider = await readProviderConfig(auth.admin); } catch { return NextResponse.json({ error: "Sağlayıcı ayarları çözülemedi." }, { status: 503 }); }
    if (flags.data.emailEnabled && !(provider.resendApiKey && provider.resendFromEmail)) return NextResponse.json({ error: "Resend ayarları eksik." }, { status: 409 });
    if (flags.data.smsEnabled && !(provider.netgsmUsercode && provider.netgsmPassword && provider.netgsmMsgheader)) return NextResponse.json({ error: "Netgsm ayarları eksik." }, { status: 409 });
    const { error } = await auth.session.rpc("write_admin_audit", { event_action: "platform.verification_settings.updated", event_target_type: "platform_settings", event_target_id: "global", event_metadata: { emailEnabled: flags.data.emailEnabled, smsEnabled: flags.data.smsEnabled } });
    return error ? NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 503 }) : NextResponse.json({ emailEnabled: flags.data.emailEnabled, smsEnabled: flags.data.smsEnabled });
  }
  const decision = review.safeParse(body);
  if (!decision.success) return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  const { data: reviewed, error } = await auth.admin.rpc("review_profile_verification", { p_request: decision.data.requestId, p_status: decision.data.status, p_admin: auth.user.id });
  if (error || !reviewed) return NextResponse.json({ error: "Bekleyen istek incelenemedi." }, { status: 409 });
  await auth.session.rpc("write_admin_audit", { event_action: `profile.verification.${decision.data.status}`, event_target_type: "verification_request", event_target_id: decision.data.requestId, event_metadata: {} });
  return NextResponse.json({ ok: true });
}

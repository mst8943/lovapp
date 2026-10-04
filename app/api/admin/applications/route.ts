import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { deliveryUpdate, sendApplicationDecision } from "@/lib/application-notifications";

const patchSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["reviewing", "approved", "rejected"]),
  adminNote: z.string().trim().max(2000).optional().default(""),
});

const fields = "id,application_code,email,phone_e164,full_name,instagram_username,occupation,industry,city,application_note,marketing_consent,notification_consent,status,admin_note,reviewed_at,invited_at,created_at,receipt_email_sent_at,receipt_sms_sent_at,decision_email_sent_at,decision_sms_sent_at,invitation_sms_sent_at,notification_last_error";

export async function GET(request: Request) {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  let query = auth.admin.from("membership_applications").select(fields).order("created_at", { ascending: false }).limit(300);
  if (status && ["submitted", "reviewing", "approved", "rejected", "invited"].includes(status)) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Başvurular yüklenemedi." }, { status: 503 });
  return NextResponse.json({ applications: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Başvuru işlemini kontrol edin." }, { status: 400 });
  const now = new Date().toISOString();
  const { data, error } = await auth.admin.from("membership_applications").update({
    status: parsed.data.status,
    admin_note: parsed.data.adminNote || null,
    reviewed_by: auth.user.id,
    reviewed_at: now,
    updated_at: now,
  }).eq("id", parsed.data.applicationId).in("status", ["submitted", "reviewing", "approved", "rejected"]).select(fields).single();
  if (error) return NextResponse.json({ error: "Başvuru güncellenemedi." }, { status: 409 });
  if (["approved", "rejected"].includes(parsed.data.status) && data.notification_consent && data.phone_e164 && !data.decision_email_sent_at && !data.decision_sms_sent_at) {
    const deliveries = await sendApplicationDecision({
      fullName: data.full_name,
      email: data.email,
      phoneE164: data.phone_e164,
      applicationCode: data.application_code,
    }, parsed.data.status as "approved" | "rejected");
    await auth.admin.from("membership_applications").update(deliveryUpdate(deliveries, "decision")).eq("id", data.id);
  }
  await auth.session.rpc("write_admin_audit", { event_action: `membership.application.${parsed.data.status}`, event_target_type: "membership_application", event_target_id: parsed.data.applicationId, event_metadata: { applicationCode: data.application_code } });
  return NextResponse.json({ application: data });
}

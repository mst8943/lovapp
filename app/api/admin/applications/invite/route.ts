import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { deliveryUpdate, sendInvitationSms } from "@/lib/application-notifications";

const schema = z.object({ applicationId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Başvuru kimliği geçersiz." }, { status: 400 });

  const { data: application } = await auth.admin.from("membership_applications")
    .select("id,email,phone_e164,full_name,application_code,status,notification_consent")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();
  if (!application || !["approved", "invited"].includes(application.status)) return NextResponse.json({ error: "Önce başvuruyu kabul edin." }, { status: 409 });
  if (application.status === "invited") return NextResponse.json({ error: "Bu başvuruya davetiye zaten gönderildi." }, { status: 409 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr";
  const { data, error } = await auth.admin.auth.admin.inviteUserByEmail(application.email, {
    redirectTo: `${appUrl}/update-password`,
    data: { full_name: application.full_name, membership_application_id: application.id, application_code: application.application_code, approved_member: true },
  });
  if (error?.code === "email_exists" || error?.code === "user_already_exists") {
    return NextResponse.json({ error: "Bu e-postayla zaten bir hesap var; hesabı doğrulamadan davet gönderilemez." }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: "Davetiye e-postası gönderilemedi." }, { status: 502 });
  if (!data.user) return NextResponse.json({ error: "Davetiye hesabı oluşturulamadı." }, { status: 502 });

  const { error: metadataError } = await auth.admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { approved_member: true, membership_application_id: application.id, application_code: application.application_code },
  });
  if (metadataError) return NextResponse.json({ error: "Davetiye oluşturuldu ancak üyelik yetkisi tanımlanamadı." }, { status: 500 });

  const now = new Date().toISOString();
  const { error: updateError } = await auth.admin.from("membership_applications")
    .update({ status: "invited", invited_user_id: data.user.id, invited_at: now, reviewed_by: auth.user.id, reviewed_at: now, updated_at: now })
    .eq("id", application.id)
    .eq("status", "approved");
  if (updateError) return NextResponse.json({ error: "Davetiye gönderildi ancak başvuru durumu güncellenemedi." }, { status: 500 });

  if (application.notification_consent && application.phone_e164) {
    const sms = await sendInvitationSms({ phoneE164: application.phone_e164, applicationCode: application.application_code });
    await auth.admin.from("membership_applications").update(deliveryUpdate([sms], "invitation")).eq("id", application.id);
  }
  await auth.session.rpc("write_admin_audit", {
    event_action: "membership.application.invited",
    event_target_type: "membership_application",
    event_target_id: application.id,
    event_metadata: { applicationCode: application.application_code },
  });
  return NextResponse.json({ invited: true });
}

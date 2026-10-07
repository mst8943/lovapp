import type { SupabaseClient } from "@supabase/supabase-js";

const PROMPT_WINDOW_MS = 24 * 3_600_000;
const GRACE_MS = 30 * 60_000;

const ascii = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/İ/g, "I").replace(/ş/g, "s").replace(/Ş/g, "S").replace(/ğ/g, "g").replace(/Ğ/g, "G").replace(/[^\x20-\x7e]/g, "");

// Step 1: when a plan's end time passes, ask the member whether everything is fine.
// Step 2: 30 minutes later, with no confirmation, text the emergency contact the member chose.
export type SafetyDeps = {
  sendPush: (profileId: string, payload: { title: string; body: string; url?: string; tag?: string }) => Promise<unknown>;
  sendSms: (phone: string, message: string) => Promise<{ sent: boolean }>;
  notifyOps: (title: string, fields: Record<string, string>, dedupeKey: string) => Promise<unknown>;
};

export async function processSafetyCheckins(admin: SupabaseClient, deps: SafetyDeps, now = new Date()) {
  const result = { prompted: 0, escalated: 0 };
  const iso = now.toISOString();

  const { data: due } = await admin.from("private_date_plans")
    .select("id,profile_id,venue")
    .in("status", ["scheduled", "checked_in"]).is("safe_confirmed_at", null).is("safety_prompted_at", null)
    .lte("expected_end_at", iso).gt("expected_end_at", new Date(now.getTime() - PROMPT_WINDOW_MS).toISOString())
    .limit(50);
  for (const plan of due ?? []) {
    const { data: claimed } = await admin.from("private_date_plans").update({ safety_prompted_at: iso }).eq("id", plan.id).is("safety_prompted_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    await deps.sendPush(plan.profile_id, { title: "Her şey yolunda mı?", body: `${plan.venue} buluşmanın bitiş saati geçti. Güvende olduğunu onayla.`, url: "/?open=meetings", tag: `safety-${plan.id}` }).catch(() => undefined);
    result.prompted += 1;
  }

  const { data: overdue } = await admin.from("private_date_plans")
    .select("id,profile_id,venue,city,emergency_contact_phone,profiles(display_name)")
    .in("status", ["scheduled", "checked_in"]).is("safe_confirmed_at", null).is("emergency_notified_at", null)
    .not("emergency_contact_phone", "is", null).not("safety_prompted_at", "is", null)
    .lte("safety_prompted_at", new Date(now.getTime() - GRACE_MS).toISOString())
    .limit(20);
  if (overdue?.length) {
    for (const plan of overdue) {
      const { data: claimed } = await admin.from("private_date_plans").update({ emergency_notified_at: iso }).eq("id", plan.id).is("emergency_notified_at", null).select("id").maybeSingle();
      if (!claimed) continue;
      const owner = plan.profiles as unknown as { display_name?: string } | null;
      const first = ascii((owner?.display_name ?? "Bir Lovask uyesi").split(/\s+/)[0]) || "Bir Lovask uyesi";
      const message = `Lovask: ${first}, ${ascii(plan.venue).slice(0, 40)} bulusmasindan sonra guvende oldugunu dogrulamadi. Lutfen kendisine ulasmayi dene.`;
      const sent = await deps.sendSms(plan.emergency_contact_phone as string, message);
      await deps.sendPush(plan.profile_id, { title: "Acil durum kişin bilgilendirildi", body: sent.sent ? "Güvende olduğunu onaylamadığın için acil durum kişine SMS gönderdik." : "Güvende olduğunu onaylamadın. Lütfen planını kontrol et.", url: "/?open=meetings", tag: `safety-alert-${plan.id}` }).catch(() => undefined);
      await deps.notifyOps("Buluşma güvenlik alarmı", { planId: plan.id, city: plan.city, smsSent: String(sent.sent) }, `safety:${plan.id}`).catch(() => undefined);
      result.escalated += 1;
    }
  }
  return result;
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_ROWS = 20000;

function cell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const line = (values: unknown[]) => values.map(cell).join(";");

export async function GET(request: Request) {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;
  const type = new URL(request.url).searchParams.get("type");
  const lines: string[] = [];
  if (type === "users") {
    const emails = new Map<string, string | null>();
    for (let page = 1; page <= 20; page += 1) {
      const { data } = await auth.admin.auth.admin.listUsers({ page, perPage: 1000 });
      for (const item of data?.users ?? []) emails.set(item.id, item.email ?? null);
      if ((data?.users.length ?? 0) < 1000) break;
    }
    lines.push(line(["Profil ID", "Ad", "E-posta", "Telefon", "Seviye", "XP", "Keşfette", "Kayıt tarihi", "Noir bitişi", "Son görülme"]));
    for (let from = 0; from < MAX_ROWS; from += 1000) {
      const { data: profiles, error } = await auth.admin.from("profiles").select("id,user_id,display_name,level,xp,is_discoverable,created_at").eq("kind", "human").order("created_at", { ascending: false }).range(from, from + 999);
      if (error) return NextResponse.json({ error: "Kullanıcılar dışa aktarılamadı." }, { status: 500 });
      if (!profiles?.length) break;
      const ids = profiles.map((profile) => profile.id);
      const [phones, entitlements, presence] = await Promise.all([
        auth.admin.from("private_profile_data").select("profile_id,phone").in("profile_id", ids),
        auth.admin.from("user_entitlements").select("profile_id,noir_until").in("profile_id", ids),
        auth.admin.from("profile_presence").select("profile_id,last_seen_at").in("profile_id", ids),
      ]);
      const phoneMap = new Map((phones.data ?? []).map((item) => [item.profile_id, item.phone]));
      const noirMap = new Map((entitlements.data ?? []).map((item) => [item.profile_id, item.noir_until]));
      const seenMap = new Map((presence.data ?? []).map((item) => [item.profile_id, item.last_seen_at]));
      for (const profile of profiles) lines.push(line([profile.id, profile.display_name, profile.user_id ? emails.get(profile.user_id) : "", phoneMap.get(profile.id), profile.level, profile.xp, profile.is_discoverable ? "evet" : "hayır", profile.created_at, noirMap.get(profile.id), seenMap.get(profile.id)]));
      if (profiles.length < 1000) break;
    }
  } else if (type === "payments") {
    lines.push(line(["Sipariş ID", "Kullanıcı", "Paket", "Tutar", "Para birimi", "Durum", "Sağlayıcı", "Gönderen", "Ödeme tarihi", "Oluşturuldu", "İncelendi", "Red nedeni"]));
    for (let from = 0; from < MAX_ROWS; from += 1000) {
      const { data: orders, error } = await auth.admin.from("payment_orders").select("id,amount,currency,status,provider,sender_full_name,payment_date,created_at,reviewed_at,rejection_reason,premium_plans(name),profiles(display_name)").order("created_at", { ascending: false }).range(from, from + 999);
      if (error) return NextResponse.json({ error: "Ödemeler dışa aktarılamadı." }, { status: 500 });
      if (!orders?.length) break;
      for (const order of orders) {
        const plan = order.premium_plans as unknown as { name?: string } | null;
        const owner = order.profiles as unknown as { display_name?: string } | null;
        lines.push(line([order.id, owner?.display_name, plan?.name, order.amount, order.currency, order.status, order.provider, order.sender_full_name, order.payment_date, order.created_at, order.reviewed_at, order.rejection_reason]));
      }
      if (orders.length < 1000) break;
    }
  } else {
    return NextResponse.json({ error: "Geçersiz dışa aktarma türü." }, { status: 400 });
  }
  await auth.session.rpc("write_admin_audit", { event_action: `export.${type}`, event_target_type: "export", event_target_id: null, event_metadata: { rows: lines.length - 1 } });
  return new NextResponse(`\uFEFFsep=;\n${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

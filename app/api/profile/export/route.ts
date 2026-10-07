import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const LIMIT = 5000;

export async function GET() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu bağlantısı gerekli." }, { status: 503 });
  const { data: profile } = await admin.from("profiles").select("*").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
  const id = profile.id as string;
  const [privateData, photos, swipes, matches, messages, visits, entitlement, orders] = await Promise.all([
    admin.from("private_profile_data").select("*").eq("profile_id", id).maybeSingle(),
    admin.from("profile_photos").select("id,is_primary,created_at").eq("profile_id", id).limit(LIMIT),
    admin.from("swipes").select("target_id,direction,created_at").eq("swiper_id", id).limit(LIMIT),
    admin.from("matches").select("id,user_a,user_b,status,matched_at,last_message_at").or(`user_a.eq.${id},user_b.eq.${id}`).limit(LIMIT),
    admin.from("messages").select("match_id,kind,body,created_at").eq("sender_id", id).order("created_at", { ascending: false }).limit(LIMIT),
    admin.from("profile_visits").select("visited_id,last_visited_at,visit_count").eq("visitor_id", id).limit(LIMIT),
    admin.from("user_entitlements").select("*").eq("profile_id", id).maybeSingle(),
    admin.from("payment_orders").select("id,amount,currency,status,provider,created_at").eq("profile_id", id).limit(LIMIT),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null, createdAt: user.created_at },
    profile,
    privateData: privateData.data ?? null,
    photos: photos.data ?? [],
    swipes: swipes.data ?? [],
    matches: matches.data ?? [],
    sentMessages: messages.data ?? [],
    profileVisits: visits.data ?? [],
    membership: entitlement.data ?? null,
    paymentOrders: orders.data ?? [],
    note: "Bu dosya hesabına bağlı kendi verilerini içerir. Başka kullanıcıların mesajları ve özel bilgileri dahil değildir.",
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="verilerim-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}

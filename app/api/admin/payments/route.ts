import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), orderId: z.string().uuid() }),
  z.object({ action: z.literal("reject"), orderId: z.string().uuid(), reason: z.string().trim().min(3).max(500) }),
]);

const countFor = async (
  admin: SupabaseClient,
  column: "status" | "provider",
  value: string,
) => {
  const result = await admin.from("payment_orders").select("id", { count: "exact", head: true }).eq(column, value);
  if (result.error || result.count === null) throw new Error("payment_count_failed");
  return result.count;
};

export async function GET() {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;

  let ordersResult, queue, approved, rejected, shopier, all, authUsers;
  try {
    [ordersResult, queue, approved, rejected, shopier, all, authUsers] = await Promise.all([
    auth.admin
      .from("payment_orders")
      .select("id,profile_id,amount,currency,status,provider,checkout_url,payment_reference,sender_full_name,payment_date,external_reference,submitted_at,proof_path,rejection_reason,created_at,reviewed_at,premium_plans(name,duration_days),profiles(display_name,user_id)")
      .order("created_at", { ascending: false })
      .limit(300),
    countFor(auth.admin, "status", "under_review"),
    countFor(auth.admin, "status", "approved"),
    countFor(auth.admin, "status", "rejected"),
    countFor(auth.admin, "provider", "shopier"),
    auth.admin.from("payment_orders").select("id", { count: "exact", head: true }),
    auth.admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
  } catch {
    return NextResponse.json({ error: "Ödeme toplamları yüklenemedi." }, { status: 503 });
  }

  if (ordersResult.error) {
    console.error("admin payments query failed", ordersResult.error);
    return NextResponse.json({ error: "Ödemeler yüklenemedi." }, { status: 500 });
  }
  if (all.error || all.count === null || authUsers.error)
    return NextResponse.json({ error: "Ödeme toplamları yüklenemedi." }, { status: 503 });

  const orders = ordersResult.data ?? [];
  const profileIds = [...new Set(orders.map((order) => order.profile_id).filter(Boolean))];
  const privateRows = profileIds.length
    ? await auth.admin.from("private_profile_data").select("profile_id,phone").in("profile_id", profileIds)
    : { data: [], error: null };
  const phoneByProfile = new Map((privateRows.data ?? []).map((row) => [row.profile_id, row.phone]));
  const emailByUser = new Map((authUsers.data?.users ?? []).map((user) => [user.id, user.email ?? null]));

  const rows = await Promise.all(orders.map(async (order) => {
    const profile = order.profiles as unknown as { display_name: string; user_id: string | null } | null;
    const proof = order.proof_path
      ? await auth.admin.storage.from("payment-proofs").createSignedUrl(order.proof_path, 300)
      : null;
    return {
      ...order,
      provider: order.provider === "shopier" && order.checkout_url?.includes("lemonsqueezy.com") ? "lemon_squeezy" : order.provider,
      phone: phoneByProfile.get(order.profile_id) ?? null,
      email: profile?.user_id ? emailByUser.get(profile.user_id) ?? null : null,
      proofUrl: proof?.data?.signedUrl ?? null,
      proof_path: undefined,
    };
  }));

  return NextResponse.json(
    {
      orders: rows,
      counts: { queue, approved, rejected, shopier, all: all.count },
      permissions: { canApprove: auth.role === "owner" },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ödeme işlemini kontrol edin." }, { status: 400 });
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const result = parsed.data.action === "approve"
    ? await auth.session.rpc("approve_noir_payment", { order_uuid: parsed.data.orderId })
    : await auth.session.rpc("reject_noir_payment", { order_uuid: parsed.data.orderId, reason: parsed.data.reason });
  if (result.error) return NextResponse.json({ error: "Sipariş daha önce işlenmiş veya bu durumda işlenemez." }, { status: 409 });
  return NextResponse.json({ updated: true, noirUntil: result.data ?? null });
}

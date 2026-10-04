import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  SHOPIER_STATIC_PRODUCTS,
  staticShopierCheckout,
} from "@/lib/shopier";

const createSchema = z.object({
  planSlug: z.enum(["noir-weekly", "noir-monthly"]),
  provider: z.enum(["bank_transfer", "papara", "crypto", "shopier"]),
});

const defaultPlans = [
  {
    slug: "noir-weekly",
    name: "Haftalık Noir",
    duration_days: 7,
    duration_minutes: null,
    price_amount: 199,
    currency: "TRY",
  },
  {
    slug: "noir-monthly",
    name: "Aylık Noir",
    duration_days: 30,
    duration_minutes: null,
    price_amount: 599,
    currency: "TRY",
  },
];

export async function GET() {
  const session = await createClient();
  const admin = createAdminClient();
  if (!admin) return noirResponse({ plans: defaultPlans, catalogOnly: true });

  const [planResult, paymentSettings] = await Promise.all([
    admin
      .from("premium_plans")
      .select("slug,name,duration_days,duration_minutes,price_amount,currency")
      .eq("is_active", true)
      .order("duration_minutes")
      .order("duration_days"),
    admin
      .from("payment_method_settings")
      .select(
        "method,enabled,account_name,bank_name,iban,papara_number,crypto_asset,crypto_network,wallet_address,instructions",
      )
      .eq("enabled", true),
  ]);
  const plans = planResult.error ? defaultPlans : (planResult.data ?? []);
  const methods = paymentSettings.data ?? [];
  if (
    !methods.some((item) => item.method === "bank_transfer") &&
    process.env.BANK_TRANSFER_IBAN
  ) {
    methods.push({
      method: "bank_transfer",
      enabled: true,
      account_name: process.env.BANK_TRANSFER_RECIPIENT ?? null,
      bank_name: null,
      iban: process.env.BANK_TRANSFER_IBAN,
      papara_number: null,
      crypto_asset: null,
      crypto_network: null,
      wallet_address: null,
      instructions: null,
    });
  }
  if (!session) return noirResponse({ plans, catalogOnly: true });
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return noirResponse({ plans, catalogOnly: true });
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!profile) return noirResponse({ plans, catalogOnly: true });
  const [entitlement, orders] = await Promise.all([
    admin
      .from("user_entitlements")
      .select("noir_until")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    admin
      .from("payment_orders")
      .select(
        "id,status,payment_reference,amount,currency,provider,checkout_url,created_at,rejection_reason,sender_full_name,payment_date,external_reference,premium_plans(name,duration_days)",
      )
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return noirResponse({
    plans,
    noirUntil: entitlement.data?.noir_until ?? null,
    orders: (orders.data ?? []).map((order) => ({
      ...order,
      provider:
        order.provider === "shopier" &&
        order.checkout_url?.includes("lemonsqueezy.com")
          ? "lemon_squeezy"
          : order.provider,
    })),
    paymentMethods: methods,
  });
}

async function noirResponse(input: {
  plans: typeof defaultPlans;
  noirUntil?: string | null;
  orders?: unknown[];
  paymentMethods?: unknown[];
  catalogOnly?: boolean;
}) {
  return NextResponse.json(
    {
      plans: input.plans,
      noirUntil: input.noirUntil ?? null,
      orders: input.orders ?? [],
      shopierEnabled: !input.catalogOnly,
      shopierPlans: Object.values(SHOPIER_STATIC_PRODUCTS)
        .filter((product) => input.plans.some((plan) =>
          plan.slug === product.planSlug &&
          Number(plan.price_amount) === product.priceAmount &&
          plan.currency === "TRY"))
        .map((product) => product.planSlug),
      paymentMethods: input.paymentMethods ?? [],
      catalogOnly: Boolean(input.catalogOnly),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Paket seçimini kontrol edin." },
      { status: 400 },
    );
  if (
    parsed.data.provider === "shopier" &&
    !staticShopierCheckout(parsed.data.planSlug)
  ) {
    return NextResponse.json(
      { error: "Bu paket için Shopier kart ödemesi bulunmuyor." },
      { status: 400 },
    );
  }
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin)
    return NextResponse.json(
      { error: "Canlı bağlantı gerekli." },
      { status: 503 },
    );
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (parsed.data.provider === "shopier") {
    const [{ data: profile }, { data: plan }] = await Promise.all([
      admin
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("kind", "human")
        .maybeSingle(),
      admin
        .from("premium_plans")
        .select("id,price_amount,currency")
        .eq("slug", parsed.data.planSlug)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
    if (!profile || !plan)
      return NextResponse.json(
        { error: "Profil veya paket bulunamadı." },
        { status: 409 },
      );
    const product = staticShopierCheckout(parsed.data.planSlug);
    if (!product || Number(plan.price_amount) !== product.priceAmount || plan.currency !== "TRY")
      return NextResponse.json({ error: "Shopier ürün fiyatı ile Noir paket fiyatı eşleşmiyor." }, { status: 409 });
    const { data: existingOrder, error: existingOrderError } = await admin
      .from("payment_orders")
      .select(
        "id,amount,currency,payment_reference,status,checkout_url,provider_checkout_id",
      )
      .eq("profile_id", profile.id)
      .eq("plan_id", plan.id)
      .eq("provider", "shopier")
      .in("status", ["awaiting_payment", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingOrderError)
      return NextResponse.json(
        { error: "Açık ödeme kontrol edilemedi." },
        { status: 503 },
      );
    if (
      existingOrder?.checkout_url &&
      existingOrder.checkout_url ===
        staticShopierCheckout(parsed.data.planSlug)?.checkoutUrl
    )
      return NextResponse.json(
        { order: existingOrder, checkoutUrl: existingOrder.checkout_url },
        { status: 200 },
      );
    if (existingOrder?.checkout_url)
      await admin
        .from("payment_orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", existingOrder.id)
        .eq("provider", "shopier");
  }
  const { data, error } = await session.rpc("create_noir_payment_order", {
    plan_slug: parsed.data.planSlug,
    // ponytail: The existing DB models Shopier as the generic card rail; migrate to a gateway column when more card providers are added.
    payment_provider: parsed.data.provider,
  });
  if (error)
    return NextResponse.json(
      {
        error: error.message.includes("plan_unavailable")
          ? "Bu paket şu anda kullanılamıyor."
          : error.message.includes("payment_method_unavailable")
            ? "Bu ödeme yöntemi şu anda kullanılamıyor."
            : "Ödeme talebi oluşturulamadı.",
      },
      { status: 400 },
    );
  const order = data as {
    id?: string;
    amount?: string | number;
    currency?: "TRY" | "USD" | "EUR";
    payment_reference?: string;
  } | null;
  if (parsed.data.provider === "shopier" && order?.id) {
    const claimedAt = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("payment_orders")
      .update({ checkout_claimed_at: claimedAt, updated_at: claimedAt })
      .eq("id", order.id)
      .eq("provider", "shopier")
      .in("status", ["awaiting_payment", "pending"])
      .is("checkout_url", null)
      .or(`checkout_claimed_at.is.null,checkout_claimed_at.lt.${staleBefore}`)
      .select("id")
      .maybeSingle();
    if (claimError)
      return NextResponse.json(
        { error: "Ödeme ekranı hazırlanamadı." },
        { status: 503 },
      );
    if (!claimed) {
      const { data: pendingOrder } = await admin
        .from("payment_orders")
        .select("checkout_url")
        .eq("id", order.id)
        .maybeSingle();
      const checkoutUrl = pendingOrder?.checkout_url as
        string | null | undefined;
      if (
        checkoutUrl === staticShopierCheckout(parsed.data.planSlug)?.checkoutUrl
      )
        return NextResponse.json({ order, checkoutUrl }, { status: 200 });
      return NextResponse.json(
        {
          error: "Ödeme ekranın hazırlanıyor. Birkaç saniye sonra tekrar dene.",
          code: "checkout_in_progress",
        },
        { status: 409 },
      );
    }
  }
  if (parsed.data.provider === "shopier") {
    if (
      !order?.id ||
      !order.amount ||
      !order.currency ||
      !order.payment_reference
    )
      return NextResponse.json(
        { error: "Shopier siparişi hazırlanamadı." },
        { status: 500 },
      );
    const checkoutUrl = staticShopierCheckout(
      parsed.data.planSlug,
    )!.checkoutUrl;
    const { error: updateError } = await admin
      .from("payment_orders")
      .update({
        checkout_url: checkoutUrl,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("provider", "shopier");
    if (updateError)
      return NextResponse.json(
        { error: "Shopier siparişi hazırlanamadı." },
        { status: 500 },
      );
    return NextResponse.json({ order, checkoutUrl }, { status: 201 });
  }
  return NextResponse.json({ order: data }, { status: 201 });
}

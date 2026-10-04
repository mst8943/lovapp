import "server-only";

const API = "https://api.lemonsqueezy.com/v1";
export type LemonPlan = "noir-hourly" | "noir-weekly" | "noir-monthly";

export function lemonConfigured() {
  return Boolean(process.env.LEMON_SQUEEZY_API_KEY && process.env.LEMON_SQUEEZY_STORE_ID && process.env.LEMON_SQUEEZY_HOURLY_VARIANT_ID && process.env.LEMON_SQUEEZY_WEEKLY_VARIANT_ID && process.env.LEMON_SQUEEZY_MONTHLY_VARIANT_ID);
}

export async function createLemonCheckout(input: { plan: LemonPlan; reference: string; orderId: string }) {
  const variant = input.plan === "noir-hourly" ? process.env.LEMON_SQUEEZY_HOURLY_VARIANT_ID : input.plan === "noir-weekly" ? process.env.LEMON_SQUEEZY_WEEKLY_VARIANT_ID : process.env.LEMON_SQUEEZY_MONTHLY_VARIANT_ID;
  const store = process.env.LEMON_SQUEEZY_STORE_ID;
  if (!variant || !store || !process.env.LEMON_SQUEEZY_API_KEY) throw new Error("lemon_not_configured");
  const response = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: { Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json", Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}` },
    body: JSON.stringify({ data: { type: "checkouts", attributes: { checkout_options: { embed: false, locale: "tr" }, product_options: { redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr"}/noir`, enabled_variants: [Number(variant)] }, checkout_data: { custom: { order_id: input.orderId, payment_reference: input.reference } } }, relationships: { store: { data: { type: "stores", id: store } }, variant: { data: { type: "variants", id: variant } } } } }),
  });
  if (!response.ok) throw new Error(`lemon_api_${response.status}`);
  const body = await response.json() as { data?: { id?: string; attributes?: { url?: string } } };
  const checkoutUrl = body.data?.attributes?.url;
  if (!body.data?.id || !checkoutUrl) throw new Error("lemon_checkout_missing_fields");
  return { checkoutId: body.data.id, checkoutUrl };
}

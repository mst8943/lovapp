export type ShopierOrder = {
  id: string | number;
  paymentStatus?: "paid" | "unpaid";
  currency?: "TRY" | "USD" | "EUR";
  totals?: { total?: string };
  shippingInfo?: { email?: string };
  billingInfo?: { email?: string };
  lineItems?: Array<{
    productId?: string | number;
    quantity?: number;
    price?: string;
    total?: string;
  }>;
};

export type ShopierTransaction = {
  orderId?: string | number;
  type?: "charge" | "adjustment";
  gross?: { originCurrency?: string; originAmount?: string };
};

export function matchesShopierPayment(
  order: ShopierOrder,
  transaction: ShopierTransaction,
  expected: { productId: string; amount: string | number; currency: string },
) {
  const item = order.lineItems?.length === 1 ? order.lineItems[0] : null;
  return (
    order.paymentStatus === "paid" &&
    item?.productId != null &&
    String(item.productId) === expected.productId &&
    item.quantity === 1 &&
    sameMoney(item.price, expected.amount) &&
    (item.total === undefined || sameMoney(item.total, expected.amount)) &&
    order.currency === expected.currency &&
    sameMoney(order.totals?.total, expected.amount) &&
    String(transaction.orderId) === String(order.id) &&
    transaction.type === "charge" &&
    transaction.gross?.originCurrency === expected.currency &&
    sameMoney(transaction.gross?.originAmount, expected.amount)
  );
}

function sameMoney(
  first: string | number | null | undefined,
  second: string | number | null | undefined,
) {
  const amount = toMinorUnits(first);
  return amount !== null && amount === toMinorUnits(second);
}

function toMinorUnits(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

import assert from "node:assert/strict";
import { matchesShopierPayment } from "../lib/shopier-payment.ts";

const expected = { productId: "product-123", amount: "199.00", currency: "TRY" };
const order = { id: "order-123", paymentStatus: "paid", currency: "TRY", totals: { total: "199.00" }, lineItems: [{ productId: expected.productId, quantity: 1, price: "199.00", total: "199.00" }] };
const transaction = { orderId: order.id, type: "charge", gross: { originCurrency: "TRY", originAmount: "199.00" } };

assert.equal(matchesShopierPayment(order, transaction, expected), true);
assert.equal(matchesShopierPayment({ ...order, paymentStatus: "unpaid" }, transaction, expected), false);
assert.equal(matchesShopierPayment({ ...order, lineItems: [{ ...order.lineItems[0], productId: "another-product" }] }, transaction, expected), false);
assert.equal(matchesShopierPayment({ ...order, lineItems: [...order.lineItems, order.lineItems[0]] }, transaction, expected), false);
assert.equal(matchesShopierPayment({ ...order, totals: { total: "1.00" } }, transaction, expected), false);
assert.equal(matchesShopierPayment({ ...order, currency: "USD" }, transaction, expected), false);
assert.equal(matchesShopierPayment(order, { ...transaction, orderId: "another-order" }, expected), false);
assert.equal(matchesShopierPayment(order, { ...transaction, type: "adjustment" }, expected), false);
assert.equal(matchesShopierPayment(order, { ...transaction, gross: { ...transaction.gross, originAmount: "19.90" } }, expected), false);
console.log("Shopier ödeme doğrulaması: 9 senaryo geçti.");

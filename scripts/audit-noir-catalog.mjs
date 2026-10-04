import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://localhost:3000";
const response = await fetch(`${base}/api/noir`);
const body = await response.json();

assert.equal(response.status, 200);
assert.ok(Array.isArray(body.plans) && body.plans.length > 0, "Noir paketi dönmedi");
for (const plan of body.plans) {
  assert.ok(plan.slug && plan.name && plan.duration_days > 0 && plan.price_amount > 0 && plan.currency);
}
console.log(`${body.plans.length} Noir paketi hazır: ${body.plans.map((plan) => plan.slug).join(", ")}`);

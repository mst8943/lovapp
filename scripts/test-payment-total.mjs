import assert from "node:assert/strict";
import { matchesPaymentTotal } from "../lib/payment-total.ts";

assert.equal(matchesPaymentTotal(19900, 19900), true);
assert.equal(matchesPaymentTotal(19800, 19900), false);
assert.equal(matchesPaymentTotal(20000, 19900), false);
assert.equal(matchesPaymentTotal(undefined, 19900), false);

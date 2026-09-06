import test from "node:test";
import assert from "node:assert/strict";

import "../helpers/test-env.js";

test("test environment is configured", () => {
assert.equal(process.env.NODE_ENV, "test");
assert.ok(process.env.JWT_SECRET);
assert.ok(process.env.JWT_EXPIRES_IN);
assert.equal(process.env.PAYMENT_CURRENCY, "INR");
});

test("required payment test configuration exists", () => {
assert.ok(process.env.RAZORPAY_KEY_ID);
assert.ok(process.env.RAZORPAY_KEY_SECRET);
assert.ok(process.env.RAZORPAY_WEBHOOK_SECRET);
});

test("test configuration does not use production Razorpay secrets", () => {
assert.equal(
process.env.RAZORPAY_KEY_ID,
"test_key_id"
);

assert.equal(
process.env.RAZORPAY_KEY_SECRET,
"test_key_secret"
);

assert.equal(
process.env.RAZORPAY_WEBHOOK_SECRET,
"test_webhook_secret"
);
});

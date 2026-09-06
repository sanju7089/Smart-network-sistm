import test from "node:test";
import assert from "node:assert/strict";

test("test environment is configured", () => {
  assert.equal(process.env.NODE_ENV, "test");
  assert.ok(process.env.JWT_SECRET);
  assert.equal(process.env.PAYMENT_CURRENCY, "INR");
});

test("required payment test configuration exists", () => {
  assert.ok(process.env.RAZORPAY_KEY_ID);
  assert.ok(process.env.RAZORPAY_KEY_SECRET);
  assert.ok(process.env.RAZORPAY_WEBHOOK_SECRET);
});

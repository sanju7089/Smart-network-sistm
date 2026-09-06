import test from "node:test";
import assert from "node:assert/strict";

import "../helpers/test-env.js";

const PAYMENT_STATUSES = [
  "created",
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded"
];

const PAYMENT_METHODS = [
  "razorpay",
  "cash",
  "bank_transfer"
];

function isValidAmount(amount) {
  return Number.isSafeInteger(amount) && amount >= 100;
}

function isValidCurrency(currency) {
  return (
    typeof currency === "string" &&
    /^[A-Z]{3}$/.test(currency)
  );
}

function isValidPaymentStatus(status) {
  return PAYMENT_STATUSES.includes(status);
}

function isValidPaymentMethod(method) {
  return PAYMENT_METHODS.includes(method);
}

test("payment currency is INR", () => {
  assert.equal(
    process.env.PAYMENT_CURRENCY,
    "INR"
  );
});

test("all supported payment statuses are valid", () => {
  for (const status of PAYMENT_STATUSES) {
    assert.equal(
      isValidPaymentStatus(status),
      true
    );
  }
});

test("invalid payment status is rejected", () => {
  assert.equal(
    isValidPaymentStatus("successful"),
    false
  );
});

test("all supported payment methods are valid", () => {
  for (const method of PAYMENT_METHODS) {
    assert.equal(
      isValidPaymentMethod(method),
      true
    );
  }
});

test("invalid payment method is rejected", () => {
  assert.equal(
    isValidPaymentMethod("card"),
    false
  );
});

test("valid INR currency format is accepted", () => {
  assert.equal(
    isValidCurrency("INR"),
    true
  );
});

test("lowercase currency is rejected", () => {
  assert.equal(
    isValidCurrency("inr"),
    false
  );
});

test("invalid currency length is rejected", () => {
  assert.equal(
    isValidCurrency("IN"),
    false
  );

  assert.equal(
    isValidCurrency("INRR"),
    false
  );
});

test("minimum valid payment amount is accepted", () => {
  assert.equal(
    isValidAmount(100),
    true
  );
});

test("payment amount below minimum is rejected", () => {
  assert.equal(
    isValidAmount(99),
    false
  );

  assert.equal(
    isValidAmount(0),
    false
  );
});

test("negative payment amount is rejected", () => {
  assert.equal(
    isValidAmount(-100),
    false
  );
});

test("decimal payment amount is rejected", () => {
  assert.equal(
    isValidAmount(100.5),
    false
  );
});

test("unsafe integer payment amount is rejected", () => {
  assert.equal(
    isValidAmount(Number.MAX_SAFE_INTEGER + 1),
    false
  );
});

test("Razorpay test credentials are available", () => {
  assert.ok(
    process.env.RAZORPAY_KEY_ID
  );

  assert.ok(
    process.env.RAZORPAY_KEY_SECRET
  );

  assert.ok(
    process.env.RAZORPAY_WEBHOOK_SECRET
  );
});

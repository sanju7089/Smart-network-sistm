import test from "node:test";
import assert from "node:assert/strict";

import "../../tests/helpers/test-env.js";

test("server configuration exposes the expected API port setting", () => {
  const port = Number(process.env.PORT);

  assert.equal(
    Number.isFinite(port),
    true
  );

  assert.equal(
    port >= 0,
    true
  );
});

test("test environment never uses a production Razorpay secret", () => {
  assert.equal(
    process.env.NODE_ENV,
    "test"
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

test("API test environment has JWT configuration", () => {
  assert.ok(
    process.env.JWT_SECRET
  );

  assert.ok(
    process.env.JWT_EXPIRES_IN
  );
});

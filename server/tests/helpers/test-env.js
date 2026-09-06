"use strict";

process.env.NODE_ENV = "test";

process.env.PORT = process.env.PORT || "0";

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "swn-test-jwt-secret-change-only-for-tests-123456789";

process.env.JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || "1h";

process.env.PAYMENT_CURRENCY =
  process.env.PAYMENT_CURRENCY || "INR";

process.env.RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID || "test_key_id";

process.env.RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET || "test_key_secret";

process.env.RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret";

export const TEST_USER = {
  name: "SWN Test User",
  email: "swn-test@example.com",
  password: "TestPassword123!"
};

export const TEST_WORKER = {
  name: "SWN Test Worker",
  service: "Plumbing",
  location: "Bhopal",
  phone: "9999999999"
};

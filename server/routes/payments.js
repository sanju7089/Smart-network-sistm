import express from "express";

import {
  requireAuth,
  requireRole
} from "../middleware/authMiddleware.js";

import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMyPayments,
  getPaymentById,
  getAllPayments
} from "../controllers/paymentController.js";

const router =
  express.Router();

router.use(
  requireAuth
);

/*
========================================
MY PAYMENTS
========================================
*/

router.get(
  "/",
  getMyPayments
);

/*
========================================
ADMIN PAYMENTS
========================================

IMPORTANT:
Admin-only protection.
*/

router.get(
  "/admin/all",
  requireRole("admin"),
  getAllPayments
);

/*
========================================
RAZORPAY ORDER
========================================
*/

router.post(
  "/razorpay/order",
  createRazorpayOrder
);

/*
========================================
RAZORPAY PAYMENT VERIFICATION
========================================
*/

router.post(
  "/razorpay/verify",
  verifyRazorpayPayment
);

/*
========================================
SINGLE PAYMENT
========================================
*/

router.get(
  "/:id",
  getPaymentById
);

export default router;

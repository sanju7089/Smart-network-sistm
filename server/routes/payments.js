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

const router = express.Router();

router.use(requireAuth);

/*
========================================
RAZORPAY PUBLIC CONFIG
========================================

RAZORPAY_KEY_ID is safe to expose to the
frontend. NEVER expose RAZORPAY_KEY_SECRET.
========================================
*/

router.get(
  "/razorpay/config",
  (req, res) => {
    const keyId = String(
      process.env.RAZORPAY_KEY_ID || ""
    ).trim();

    const currency = String(
      process.env.PAYMENT_CURRENCY || "INR"
    )
      .trim()
      .toUpperCase();

    if (!keyId) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay public key is not configured."
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        keyId,
        currency
      }
    });
  }
);

/*
========================================
PAYMENT HISTORY
========================================
*/

router.get(
  "/",
  getMyPayments
);

/*
========================================
ADMIN PAYMENT HISTORY
========================================
*/

router.get(
  "/admin/all",
  requireRole("admin"),
  getAllPayments
);

/*
========================================
CREATE RAZORPAY ORDER
========================================
*/

router.post(
  "/razorpay/order",
  createRazorpayOrder
);

/*
========================================
VERIFY RAZORPAY PAYMENT
========================================
*/

router.post(
  "/razorpay/verify",
  verifyRazorpayPayment
);

/*
========================================
PAYMENT BY ID
========================================
*/

router.get(
  "/:id",
  getPaymentById
);

export default router;

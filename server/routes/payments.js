import express from "express";

import {
  requireAuth
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
PAYMENT LIST
========================================
*/

router.get(
  "/",
  getMyPayments
);

/*
========================================
ADMIN PAYMENT LIST
========================================
*/

router.get(
  "/admin/all",
  getAllPayments
);

/*
========================================
RAZORPAY
========================================
*/

router.post(
  "/razorpay/order",
  createRazorpayOrder
);

router.post(
  "/razorpay/verify",
  verifyRazorpayPayment
);

/*
========================================
SINGLE PAYMENT
Must remain after named routes.
========================================
*/

router.get(
  "/:id",
  getPaymentById
);

export default router;

import express from "express";

import {
  requireAuth
} from "../middleware/authMiddleware.js";

import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMyPayments
} from "../controllers/paymentController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", getMyPayments);

router.post(
  "/razorpay/order",
  createRazorpayOrder
);

router.post(
  "/razorpay/verify",
  verifyRazorpayPayment
);

export default router;

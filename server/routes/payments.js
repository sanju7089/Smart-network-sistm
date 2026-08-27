import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePaymentStatus
} from "../controllers/paymentController.js";

const router = express.Router();

// सभी payment routes के लिए login जरूरी है
router.use(requireAuth);

// अपनी payments / Admin के लिए सभी payments
router.get("/", getPayments);

// नया payment record बनाना
router.post("/", createPayment);

// Payment status update (Admin only check controller में है)
router.patch("/:id/status", updatePaymentStatus);

// एक specific payment देखना
router.get("/:id", getPaymentById);

export default router;

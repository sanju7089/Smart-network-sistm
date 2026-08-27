import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

const payments = [];

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: payments
  });
});

router.post("/", (req, res) => {
  const { amount, bookingId, method } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid payment amount is required."
    });
  }

  const payment = {
    id: Date.now().toString(),
    userId: req.user.id,
    bookingId: bookingId || null,
    amount: Number(amount),
    method: method || "pending",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  payments.unshift(payment);

  res.status(201).json({
    success: true,
    message: "Payment record created.",
    data: payment
  });
});

router.get("/:id", (req, res) => {
  const payment = payments.find(
    (item) => item.id === req.params.id
  );

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment not found."
    });
  }

  res.json({
    success: true,
    data: payment
  });
});

export default router;

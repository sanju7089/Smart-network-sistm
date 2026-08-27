import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Bookings API is working.",
    data: []
  });
});

router.post("/", (req, res) => {
  res.status(201).json({
    success: true,
    message: "Booking request received.",
    data: req.body
  });
});

router.get("/:id", (req, res) => {
  res.json({
    success: true,
    message: `Booking ${req.params.id} endpoint is working.`
  });
});

export default router;

import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

import {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  cancelBooking
} from "../controllers/bookingController.js";

const router = express.Router();

// सभी booking routes के लिए login जरूरी है
router.use(requireAuth);

// अपनी bookings / role के अनुसार bookings
router.get("/", getBookings);

// नई booking बनाना
router.post("/", createBooking);

// Booking cancel करना
router.patch("/:id/cancel", cancelBooking);

// Booking status update करना
router.patch("/:id/status", updateBookingStatus);

// एक specific booking देखना
router.get("/:id", getBookingById);

export default router;

import express from "express";

import {
  requireAuth
} from "../middleware/authMiddleware.js";

import {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  cancelBooking
} from "../controllers/bookingController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", getBookings);

router.post("/", createBooking);

router.patch(
  "/:id/cancel",
  cancelBooking
);

router.patch(
  "/:id/status",
  updateBookingStatus
);

router.get(
  "/:id",
  getBookingById
);

export default router;

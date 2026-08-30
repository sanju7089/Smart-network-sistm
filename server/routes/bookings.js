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

/*
========================================
ALL BOOKING ROUTES REQUIRE LOGIN
========================================
*/

router.use(requireAuth);

/*
========================================
LIST + CREATE
========================================
*/

router.get(
  "/",
  getBookings
);

router.post(
  "/",
  createBooking
);

/*
========================================
STATUS / CANCEL
Must come before /:id
========================================
*/

router.patch(
  "/:id/cancel",
  cancelBooking
);

router.patch(
  "/:id/status",
  updateBookingStatus
);

/*
========================================
SINGLE BOOKING
========================================
*/

router.get(
  "/:id",
  getBookingById
);

export default router;

import express from "express";

import {
  requireAuth,
  requireRole
} from "../middleware/authMiddleware.js";

import {
  getDashboard,
  getAdminUsers,
  getAdminJobs,
  getAdminWorkers,
  getAdminBookings,
  getAdminPayments,
  getAdminReport
} from "../controllers/adminController.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("admin"));

router.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Admin API is working.",
    admin: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

router.get(
  "/dashboard",
  getDashboard
);

router.get(
  "/users",
  getAdminUsers
);

router.get(
  "/jobs",
  getAdminJobs
);

router.get(
  "/workers",
  getAdminWorkers
);

router.get(
  "/bookings",
  getAdminBookings
);

router.get(
  "/payments",
  getAdminPayments
);

router.get(
  "/reports",
  getAdminReport
);

export default router;

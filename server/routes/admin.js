import express from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("admin"));

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Admin API is working.",
    admin: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

router.get("/dashboard", (req, res) => {
  res.json({
    success: true,
    message: "Admin dashboard data will be available here."
  });
});

export default router;
